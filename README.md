# Checklist EMR Questões

Aplicação web para gerenciamento de checklist de questões da equipe EMR.

## Funcionalidades

- **Usuário EMR**: Visualiza itens do checklist e envia respostas (texto e link opcional) para cada questão.
- **Administrador**: Gerencia itens do checklist — cria, edita, exclui — e visualiza todas as respostas enviadas com timestamps.

## Credenciais

| Usuário | Login | Senha | Permissões |
|---------|-------|-------|------------|
| EMR | emr | emr | Visualizar itens, enviar respostas |
| Admin | admin | admin | Acesso total (CRUD itens + ver respostas) |

## Stack

- HTML + Tailwind CSS (CDN)
- JavaScript vanilla
- Supabase (PostgreSQL + REST API + RPC)
- GitHub Pages (hospedagem)
