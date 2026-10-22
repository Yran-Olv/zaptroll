# Regra de Continuidade do Projeto ZapTroll

1. **Memória de Sessão Obrigatória**:
   - Sempre que uma conversa for iniciada neste workspace, o assistente DEVE consultar imediatamente o arquivo [PROJECT_MEMORY.md](file:///home/yran/Área%20de%20trabalho/zaptroll/PROJECT_MEMORY.md) e verificar o estado atual do `git status`.
   - Se o usuário perguntar de onde paramos ou o que fazer a seguir, o assistente deve responder com precisão cirúrgica baseando-se no `PROJECT_MEMORY.md` e nos commits recentes.

2. **Manutenção da Memória Viva**:
   - Ao concluir alterações de funcionalidade, refatorações, criação de novas páginas ou correções de bugs, o assistente DEVE atualizar o [PROJECT_MEMORY.md](file:///home/yran/Área%20de%20trabalho/zaptroll/PROJECT_MEMORY.md) com o que foi feito, arquivos alterados e pendências restantes.
   - Dessa forma, mesmo que uma nova janela de conversa seja aberta pelo usuário ou pela IDE, o histórico e o ritmo de trabalho nunca serão perdidos.
