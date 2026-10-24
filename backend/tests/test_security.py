"""Testes isolados: não usa Google, Mercado Pago ou banco do estabelecimento."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_tmp = tempfile.TemporaryDirectory()
os.environ.update({
    'DATABASE_URL': f'sqlite:///{Path(_tmp.name) / "test.db"}',
    'SECRET_KEY': 'test-only-key-' + 'x' * 48,
    'ADMIN_EMAIL': 'owner@example.test',
    'APP_ENV': 'development',
    'DEMO_MODE': 'false',
    'MERCADOPAGO_SANDBOX': 'false',
})

from fastapi.testclient import TestClient
from pydantic import ValidationError
from app import app, startup
from config import settings, Settings
from database import Base, engine, SessionLocal
from models import Usuario, Produto, Endereco, Pedido
from seed_demo import seed_demo
from services.google_auth import create_access_token


def tearDownModule():
    engine.dispose()
    _tmp.cleanup()


class SecurityTests(unittest.TestCase):
    def setUp(self):
        # Engine foi criado acima com um caminho temporário exclusivo deste teste.
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.owner = Usuario(nome='João', email_google='owner@example.test')
        self.customer = Usuario(nome='Cliente', email_google='customer@example.test')
        self.product = Produto(nome='Pastel', preco=12, categoria='Salgados', ativo=True)
        self.db.add_all([self.owner, self.customer, self.product])
        self.db.commit()
        self.db.add(Endereco(usuario_id=self.customer.id, rua='Rua teste', numero='1', bairro='Centro'))
        self.db.commit()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()

    def headers(self, user):
        return {'Authorization': 'Bearer ' + create_access_token({'sub': str(user.id)})}

    def payload(self, **changes):
        body = {'pagamento': 'pix', 'tipo_entrega': 'entrega', 'taxa_entrega': 0,
                'itens': [{'produto_id': self.product.id, 'quantidade': 2}]}
        body.update(changes)
        return body

    def test_admin_requires_server_authorization(self):
        for headers, expected in [({}, 401), ({'Authorization': 'Bearer retired-static-token'}, 401),
                                  (self.headers(self.customer), 403), (self.headers(self.owner), 200)]:
            with self.subTest(expected=expected):
                self.assertEqual(self.client.get('/admin/pedidos', headers=headers).status_code, expected)

    def test_admin_identity_comes_from_database(self):
        token = create_access_token({'sub': str(self.customer.id), 'email': settings.ADMIN_EMAIL, 'is_admin': True})
        self.assertEqual(self.client.get('/admin/pedidos', headers={'Authorization': 'Bearer '+token}).status_code, 403)

    def test_profile_and_public_settings_do_not_expose_secrets(self):
        profile = self.client.get('/auth/me', headers=self.headers(self.owner)).json()
        self.assertTrue(profile['is_admin'])
        data = self.client.get('/loja').json()
        self.assertNotIn('SECRET_KEY', data)
        self.assertNotIn('ADMIN_EMAIL', data)
        self.assertNotIn(settings.SECRET_KEY, str(data))

    def test_delivery_fee_is_authoritative_and_pix_is_unpaid(self):
        with patch.object(settings, 'TAXA_ENTREGA', 7.5):
            response = self.client.post('/pedidos', json=self.payload(), headers=self.headers(self.customer))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['taxa_entrega'], 7.5)
        self.assertEqual(response.json()['itens'][0]['preco'], 12)
        self.assertFalse(response.json()['pagamento_confirmado'])

    def test_pickup_has_no_fee_and_does_not_trust_browser_address(self):
        with patch.object(settings, 'LOJA_ENDERECO', 'Local configurado'):
            response = self.client.post('/pedidos', json=self.payload(tipo_entrega='retirada', taxa_entrega=99, local_retirada='Falso'), headers=self.headers(self.customer))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['taxa_entrega'], 0)
        self.assertEqual(response.json()['local_retirada'], 'Local configurado')

    def test_invalid_quantities_and_payment_are_rejected(self):
        for quantity in [0, -2, 101, 1.5, True]:
            response = self.client.post('/pedidos', json=self.payload(itens=[{'produto_id': self.product.id, 'quantidade': quantity}]), headers=self.headers(self.customer))
            self.assertEqual(response.status_code, 422)
        response = self.client.post('/pedidos', json=self.payload(pagamento='approved'), headers=self.headers(self.customer))
        self.assertEqual(response.status_code, 422)

    def test_inactive_product_is_not_orderable(self):
        self.product.ativo = False
        self.db.commit()
        response = self.client.post('/pedidos', json=self.payload(), headers=self.headers(self.customer))
        self.assertEqual(response.status_code, 400)

    def test_simulation_is_disabled(self):
        response = self.client.post('/pagamentos/simular/1', headers=self.headers(self.customer))
        self.assertEqual(response.status_code, 404)

    def test_online_payment_cannot_be_confirmed_manually(self):
        pedido = Pedido(usuario_id=self.customer.id, pagamento='mercadopago', status='entrega')
        self.db.add(pedido)
        self.db.commit()
        response = self.client.patch(f'/admin/pedidos/{pedido.id}/pagamento', headers=self.headers(self.owner))
        self.assertEqual(response.status_code, 400)
        self.db.refresh(pedido)
        self.assertFalse(pedido.pagamento_confirmado)

    def test_demo_inserts_only_when_explicitly_enabled(self):
        self.db.delete(self.product)
        self.db.commit()
        with self.assertRaises(ValueError):
            seed_demo(self.db)
        with patch.object(settings, 'DEMO_MODE', True):
            count = seed_demo(self.db)
        self.assertGreater(count, 10)
        self.assertEqual(self.db.query(Produto).filter_by(categoria='Raspadinhas de cana').count(), 3)

    def test_restart_preserves_catalog_and_seed_refuses_existing_data(self):
        self.product.preco = 19
        self.product.ativo = False
        self.db.commit()
        startup()
        with patch.object(settings, 'DEMO_MODE', True):
            with self.assertRaises(ValueError):
                seed_demo(self.db)
        self.db.refresh(self.product)
        self.assertEqual(self.product.preco, 19)
        self.assertFalse(self.product.ativo)

    def test_production_rejects_simulation_and_weak_keys(self):
        with self.assertRaises(ValidationError):
            Settings(_env_file=None, APP_ENV='production', SECRET_KEY='x'*48, FRONTEND_URL='https://example.test', MERCADOPAGO_SANDBOX=True)
        with self.assertRaises(ValidationError):
            Settings(_env_file=None, SECRET_KEY='altere-esta-chave-secreta-em-producao')


if __name__ == '__main__':
    unittest.main()
