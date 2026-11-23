# Conferência médica e assistência

Somente OS marcadas como “Precisa passar pelo médico” ficam retidas na conferência médica. A indicação pode ser feita no lançamento guiado ou nos detalhes de uma OS aberta. As cinco etapas técnicas permanecem obrigatórias. Serviços sem indicação podem ser liberados diretamente após a montagem e resolução das ocorrências.

O retorno médico é registrado por administrador, gestor ou montador, com descrição de quem conferiu e resultado, data e usuário no histórico. Somente após esse registro a OS marcada fica pronta. Correção posterior invalida o retorno anterior. Edição concorrente exige atualização da tela. Clientes antigos também recebem o bloqueio no banco.

Assistência: abrir a área Assistência e garantias, informar o número exato da OS original, motivo, descrição, novo prazo e destino (lentes ou bancada). É criado outro serviço, com cliente, vendedora e loja da OS original. Conferir o laboratório externo no novo serviço. A OS original, conclusão, entrega e anexos permanecem preservados. As fotos e as etapas são acompanhadas nos detalhes do novo serviço. Ocorrências internas da montagem continuam na mesma área.

## Publicação

Aplicar somente `supabase/migrations/20261123100000_medical_assistance.sql`, antes de publicar o frontend. Não aplicar migrações locais não relacionadas. Migração aditiva e transacional, sem preenchimento retroativo das novas colunas. Comparar contagem e fingerprint das colunas antigas antes e depois. Testes isolados PGlite verificam liberação, autorização, correção, vínculo e preservação da entrega original.
