#!/usr/bin/env bash

set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/graphql}"
TOTAL="${TOTAL:-300}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d%H%M%S)}"
CPF_SEED="${CPF_SEED:-$(date +%s)}"
SLEEP_SECONDS="${SLEEP_SECONDS:-1}"

if ! [[ "$TOTAL" =~ ^[0-9]+$ ]] || [ "$TOTAL" -lt 1 ]; then
  echo "TOTAL must be a positive integer." >&2
  exit 1
fi

if ! [[ "$CPF_SEED" =~ ^[0-9]+$ ]]; then
  echo "CPF_SEED must be an integer." >&2
  exit 1
fi

calculate_check_digit() {
  local digits="$1"
  local start_weight="$2"
  local sum=0
  local index=0
  local digit
  local weight
  local remainder

  while [ "$index" -lt "${#digits}" ]; do
    digit="${digits:$index:1}"
    weight=$((start_weight - index))
    sum=$((sum + digit * weight))
    index=$((index + 1))
  done

  remainder=$(((sum * 10) % 11))

  if [ "$remainder" -eq 10 ]; then
    echo 0
    return
  fi

  echo "$remainder"
}

generate_cpf() {
  local index="$1"
  local base_number
  local base
  local first_digit
  local second_digit

  base_number=$((((CPF_SEED + index) % 900000000) + 100000000))
  base="$(printf "%09d" "$base_number")"
  first_digit="$(calculate_check_digit "$base" 10)"
  second_digit="$(calculate_check_digit "${base}${first_digit}" 11)"

  echo "${base}${first_digit}${second_digit}"
}

post_customer() {
  local index="$1"
  local cpf="$2"
  local email="load-test-${RUN_ID}-${index}@example.com"
  local response_file
  local http_code
  local payload
  local response

  payload=$(cat <<JSON
{
  "query": "mutation CreateCustomer(\$input: CreateCustomerInput!) { createCustomer(input: \$input) { id name email cpf } }",
  "variables": {
    "input": {
      "name": "Cliente Carga ${index}",
      "email": "${email}",
      "phone": "+55 81 99999-${index}",
      "cpf": "${cpf}",
      "address": {
        "street": "Rua da Carga",
        "number": "${index}",
        "complement": "Lote ${RUN_ID}",
        "neighborhood": "Boa Viagem",
        "city": "Recife",
        "state": "PE",
        "zipCode": "51020-000"
      }
    }
  }
}
JSON
)

  response_file="$(mktemp)"
  if ! http_code="$(
    curl -sS \
      -o "$response_file" \
      -w "%{http_code}" \
      -X POST "$API_URL" \
      -H "Content-Type: application/json" \
      --data "$payload"
  )"; then
    response="$(cat "$response_file")"
    rm -f "$response_file"
    echo "[$index/$TOTAL] Failed to call $API_URL for $email" >&2
    echo "$response" >&2
    return 1
  fi

  response="$(cat "$response_file")"
  rm -f "$response_file"

  if [[ "$http_code" != 2* ]]; then
    echo "[$index/$TOTAL] HTTP $http_code for $email" >&2
    echo "$response" >&2
    return 1
  fi

  if [[ "$response" == *'"errors"'* ]]; then
    echo "[$index/$TOTAL] GraphQL error for $email" >&2
    echo "$response" >&2
    return 1
  fi

  echo "[$index/$TOTAL] created $email"
  return 0
}

echo "Creating $TOTAL customers at $API_URL"
echo "RUN_ID=$RUN_ID CPF_SEED=$CPF_SEED"

created=0
failed=0

for index in $(seq 1 "$TOTAL"); do
  cpf="$(generate_cpf "$index")"
  if post_customer "$index" "$cpf"; then
    created=$((created + 1))
  else
    failed=$((failed + 1))
  fi

  if [ "$SLEEP_SECONDS" != "0" ]; then
    sleep "$SLEEP_SECONDS"
  fi
done

echo "Finished customer creation load. created=$created failed=$failed total=$TOTAL"
