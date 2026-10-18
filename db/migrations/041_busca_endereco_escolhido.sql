-- Banket Busca: endereço do perfil escolhido pela empresa (digitado ou sugerido pela IA). Por padrão o endereço dos planos
-- pagos acompanha o nome do buffet (atualizarEnderecosPeloNome); com slug_escolhido, ele fica como a empresa escolheu
-- até ela apagar o campo (volta ao automático) ou perder o plano pago (volta ao id do perfil).
ALTER TABLE busca_perfis ADD COLUMN IF NOT EXISTS slug_escolhido BOOLEAN NOT NULL DEFAULT false;
