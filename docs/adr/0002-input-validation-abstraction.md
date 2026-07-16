# ADR 0002: Abstração da validação de entrada

## Status

Aceito.

## Contexto

A API GraphQL precisa validar e normalizar entradas antes de chamar os casos de
uso. O projeto usa Zod, mas a aplicação não deve depender de uma biblioteca de
validação específica nem de contratos do GraphQL. Um futuro adapter HTTP REST
pode exigir a mesma validação com outra biblioteca, como Yup.

Inferir os contratos da aplicação diretamente dos schemas reduziria código,
mas tornaria tipos, transforms e erros dependentes do Zod. Tratar `ZodError`
nos resolvers também espalharia detalhes da biblioteca pela apresentação.

## Decisão

Os contratos de entrada dos casos de uso são tipos TypeScript explícitos e
independentes do domínio e do Zod.

A aplicação compartilhada define:

- `InputValidator<T>`, com a operação `validate(input: unknown): T`;
- `InputValidationError`, com uma lista neutra de caminhos e mensagens.

O adapter `ZodInputValidator<T>` executa o schema e converte `ZodError` para
`InputValidationError`. Os validators concretos do GraphQL usam schemas Zod
strict e entregam os contratos esperados pelos casos de uso. O resolver conhece
somente o validator e o erro neutro.

## Consequências

### Positivas

- Casos de uso e contratos da aplicação não dependem do Zod.
- O tratamento de erro da API não conhece erros específicos da biblioteca.
- Outro adapter pode implementar `InputValidator<T>` com Yup ou outra
  biblioteca.
- A política strict também protege chamadas que não passam pela validação do
  GraphQL.

### Negativas

- Tipos TypeScript, inputs GraphQL e schemas possuem alguma duplicação.
- Trocar a biblioteca ainda exige reescrever os schemas concretos e seus
  transforms.
- A interface atual é síncrona; validação assíncrona exigiria evoluir o
  contrato.

## Alternativas consideradas

- Inferir os comandos com `z.output`: elimina parte da duplicação, mas acopla o
  contrato da aplicação ao Zod.
- Usar Zod diretamente no resolver: é mais simples, mas espalha a dependência e
  o formato de erro pela camada de apresentação.
- Criar uma DSL própria para schemas: esconderia as bibliotecas ao custo de
  manter uma nova abstração complexa.
