# ADR 0001: Transactional outbox para eventos de clientes

## Status

Aceito.

## Contexto

Ao criar um cliente, a aplicação precisa persistir os dados no PostgreSQL e
publicar `customer.created` para o worker de e-mail. Persistir e publicar em
operações independentes cria uma janela de dual write: a API pode confirmar o
cliente e falhar antes de entregar o evento ao RabbitMQ.

PostgreSQL e RabbitMQ não compartilham uma transação distribuída. A solução
também precisa funcionar localmente sem exigir uma infraestrutura de CDC.

## Decisão

A criação do cliente também grava uma linha em `outbox_events` na mesma
transação do PostgreSQL.

Na stack Docker, o Debezium Server captura os inserts da outbox pelo WAL,
transforma a linha no payload do evento e o publica no RabbitMQ. Para execução
local ou fallback sem CDC, a aplicação oferece um publisher polling controlado
por `OUTBOX_PUBLISHER_ENABLED`.

A publicação e o consumo assumem entrega de pelo menos uma vez. O identificador
da outbox é usado como `messageId` pelo publisher polling.

## Consequências

### Positivas

- Cliente e evento são persistidos atomicamente.
- Uma indisponibilidade temporária do RabbitMQ não perde o evento.
- O mesmo modelo suporta CDC em Docker e polling no desenvolvimento local.
- O polling permite concorrência segura com `FOR UPDATE SKIP LOCKED`.

### Negativas

- A publicação é eventual.
- Debezium, WAL lógico e replication slot aumentam o custo operacional.
- Entregas duplicadas são possíveis e os consumidores precisam tolerá-las.
- A outbox precisa de monitoramento e de uma política futura de retenção.
- Os dois publishers não devem processar a mesma outbox simultaneamente.

## Alternativas consideradas

- Publicar diretamente no RabbitMQ depois do commit: mantém a janela de perda
  entre banco e broker.
- Usar apenas polling: reduz a infraestrutura, mas mantém consultas periódicas
  sobre a tabela e maior latência de publicação.
- Usar apenas CDC: simplifica o caminho de produção, mas torna o ambiente local
  dependente do Debezium.
- Adotar transação distribuída: complexidade desproporcional e sem suporte
  natural entre os componentes escolhidos.
