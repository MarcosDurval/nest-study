# Execução e configuração

## Requisitos

- Node.js 20 ou superior
- npm
- Docker com Docker Compose
- Bash e `curl` para o script de carga

## Ambiente local

Crie o arquivo de ambiente e instale as dependências:

```bash
cp .env.example .env
npm ci
npm run prisma:generate
```

Inicie PostgreSQL, RabbitMQ e MailHog:

```bash
docker compose up -d postgres rabbitmq mailhog
npm run prisma:migrate
```

Execute a API e o worker em terminais separados:

```bash
# Terminal 1
npm run start:dev

# Terminal 2
npm run start:email
```

Nesse modo, a API usa o publisher polling da outbox porque o Debezium não foi
iniciado. O valor padrão local é `OUTBOX_PUBLISHER_ENABLED=true`.

## Docker Compose

### Stack completa

```bash
docker compose up --build -d
```

O Compose base usa as imagens de produção, executa as migrações ao iniciar a
API e publica a outbox por Debezium. O publisher polling fica desabilitado por
`DOCKER_OUTBOX_PUBLISHER_ENABLED=false`.

### API em desenvolvimento

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

Esse override executa apenas a API com `Dockerfile.dev`, watch mode e o código
fonte montado no container. O worker de e-mail continua usando a imagem do
Compose base.

O override substitui o comando que aplicaria as migrações na imagem de
produção. Na primeira execução, aplique-as pelo container da API:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api npm run prisma:deploy
```

### Simulação de falhas no e-mail

```bash
docker compose -f docker-compose.yml -f docker-compose.chaos.yml up --build -d
```

O modo chaos define `EMAIL_FAILURE_SIMULATION_ENABLED=true` e
`EMAIL_FAILURE_SIMULATION_RATE=0.5`. A falha é gerada antes da chamada SMTP para
exercitar retry e DLQ.

Para combinar desenvolvimento e chaos:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.chaos.yml up --build -d
```

### Parar os serviços

Use os mesmos arquivos empregados na subida:

```bash
docker compose down --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.chaos.yml down --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.chaos.yml down --remove-orphans
```

## URLs padrão

- GraphQL: http://localhost:3000/graphql
- RabbitMQ Management: http://localhost:15672 (`guest` / `guest`)
- MailHog: http://localhost:8025
- PostgreSQL: `localhost:5432`

O Playground e a introspection do GraphQL ficam habilitados em
`development`. Em `production`, ambos ficam desabilitados e a prevenção de
CSRF fica habilitada.

## Variáveis de ambiente

A API e o worker validam conjuntos separados de variáveis ao iniciar. Cada
processo exige somente as configurações que utiliza.

- `NODE_ENV` e `DOCKER_NODE_ENV` controlam o ambiente local e dos containers.
- `DATABASE_URL` aponta para o PostgreSQL local; `DOCKER_DATABASE_URL` usa o
  hostname interno `postgres`.
- `RABBITMQ_URL` aponta para o broker local; `DOCKER_RABBITMQ_URL` usa o
  hostname interno `rabbitmq`.
- `SMTP_HOST` aponta para o SMTP local; `DOCKER_SMTP_HOST` usa o hostname
  interno `mailhog`.
- `OUTBOX_*` controla intervalo, lote, tentativas e timeout do publisher
  polling.
- `RABBITMQ_CUSTOMER_CREATED_*` configura exchanges, routing keys, filas,
  retry e DLQ do worker.
- `EMAIL_FAILURE_SIMULATION_*` controla a simulação de falhas no envio.

Consulte `.env.example` para a lista completa e os valores padrão.

## Testes, build e formatação

```bash
npm test
npm run build
npm run format
```

Os testes são unitários e não exigem `.env.test`, PostgreSQL, RabbitMQ ou
MailHog em execução.

## Carga de clientes

Com a API em execução, o script abaixo cria 300 clientes via GraphQL:

```bash
./scripts/create-customers.sh
```

Por padrão há uma pausa de dois segundos entre requisições, portanto a carga
completa leva aproximadamente dez minutos. Os parâmetros disponíveis são:

- `API_URL`: endpoint GraphQL;
- `TOTAL`: quantidade de clientes;
- `RUN_ID`: identificador usado nos e-mails;
- `CPF_SEED`: semente numérica para geração dos CPFs;
- `SLEEP_SECONDS`: intervalo entre requisições.

Exemplo rápido:

```bash
TOTAL=50 SLEEP_SECONDS=0 ./scripts/create-customers.sh
```

Para repetir os mesmos dados, reutilize `RUN_ID` e `CPF_SEED`.

## Exemplo GraphQL

```graphql
mutation {
  createCustomer(
    input: {
      name: "Maria Silva"
      email: "maria@example.com"
      phone: "+55 81 99999-9999"
      cpf: "529.982.247-25"
      address: {
        street: "Rua das Flores"
        number: "123"
        complement: "Apt 401"
        neighborhood: "Boa Viagem"
        city: "Recife"
        state: "PE"
        zipCode: "51020-000"
      }
    }
  ) {
    id
    name
    email
  }
}
```

## PostgreSQL 18 e volumes antigos

As imagens do PostgreSQL 18 usam `/var/lib/postgresql` como diretório do
volume. Se o volume foi criado por uma versão major anterior, recrie-o:

```bash
docker compose down -v
docker compose up --build
```

Esse comando remove os dados locais persistidos no volume.
