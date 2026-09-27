-- 008_usuario_demo.sql
-- Usuário com papel "usuario" (operação, sem acesso a Configurações) na empresa de demonstração.
INSERT INTO usuarios (nome, email, senha_hash, email_verificado_em)
VALUES ('Operação Demo', 'operacao@banket.com.br', crypt('Banket.2026', gen_salt('bf')), now())
ON CONFLICT DO NOTHING;

INSERT INTO tenant_usuarios (tenant_id, usuario_id, role)
SELECT t.id, u.id, 'usuario'
  FROM tenants t, usuarios u
 WHERE t.slug = 'banket' AND u.email = 'operacao@banket.com.br'
ON CONFLICT (tenant_id, usuario_id) DO NOTHING;
