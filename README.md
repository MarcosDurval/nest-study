# NestJS DDD Customers

API GraphQL de clientes construída com NestJS, DDD, Prisma/PostgreSQL,
RabbitMQ e transactional outbox. Um worker separado consome o evento
`customer.created` e envia o e-mail de boas-vindas para o MailHog.

## Requisitos

- Node.js 20 ou superior
- npm
- Docker com Docker Compose

## Execução local

Prepare o projeto e os serviços de infraestrutura:

```bash
cp .env.example .env
npm ci
npm run prisma:generate
docker compose up -d postgres rabbitmq mailhog
npm run prisma:migrate
```

Inicie a API e o worker em terminais separados:

```bash
# Terminal 1
npm run start:dev

# Terminal 2
npm run start:email
```

## Execução com Docker

Para construir e iniciar a stack completa:

```bash
cp .env.example .env
docker compose up --build -d
```

## Serviços

As URLs usam os valores padrão do `.env.example`.

- GraphQL: http://localhost:3000/graphql
- RabbitMQ Management: http://localhost:15672 (`guest` / `guest`)
- MailHog: http://localhost:8025
- PostgreSQL: `localhost:5432`

O Playground e a introspection do GraphQL ficam disponíveis somente em
desenvolvimento.

## Verificação

```bash
npm test
npm run build
```

Os testes não dependem dos serviços Docker nem de um arquivo `.env.test`.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Execução, configuração e solução de problemas](docs/running.md)
- [Mensageria, outbox, retry e DLQ](docs/messaging.md)
- [ADR 0001: transactional outbox](docs/adr/0001-transactional-outbox-for-customer-events.md)
- [ADR 0002: abstração da validação de entrada](docs/adr/0002-input-validation-abstraction.md)
