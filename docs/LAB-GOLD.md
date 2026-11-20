# Lab Gold

Identidade clara com fundo #F7F6F3, superfícies brancas, bordas #E2DDD5 e ações #8C6239 (hover #734F2D). Texto principal #222222 e secundário #6E6A63. Navegação branca com estado ativo #F3ECE2 / #6E4B2A. Sem texturas sobre áreas de leitura.

Atenção: #C68B2C é indicador; textos pequenos usam #87601F sobre #FBF3E4 para contraste AA. Sucesso #2E7D5B (texto #286F51 sobre #E8F3EE para AA) e erro #B83A3A / #F9EAEA. Status mantêm rótulos e ícones.

## Senhas do vendedor

Cadastro e login no site/app aceitam letras, números e símbolos (mínimo 4 caracteres, limite 64 bytes UTF-8). PINs anteriores continuam válidos. Campo vazio no cadastro mantém senha atual. Hash bcrypt mantido, nunca exibido. Não houve troca automática de credenciais. Migração 20261120230000_seller_password.sql aplicada pelo SQL Editor em 20/11/2026; não registrada automaticamente no histórico CLI. Funções e grants preservados, permissão do setter nega papel ausente. Links continuam independentes. Login mais recente mantém política existente de substituir sessão app anterior.
