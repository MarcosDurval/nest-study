import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

const root = join(__dirname, "..");

describe("create-customers script", () => {
  it("continues creating customers after a GraphQL unique constraint error", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "create-customers-"));
    const counterPath = join(tempDir, "curl-count");
    const curlPath = join(tempDir, "curl");

    writeFileSync(
      curlPath,
      `#!/usr/bin/env bash
set -euo pipefail

output_file=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      output_file="$2"
      shift 2
      ;;
    -w)
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

count=0
if [ -f "$FAKE_CURL_COUNTER" ]; then
  count="$(cat "$FAKE_CURL_COUNTER")"
fi

count=$((count + 1))
echo "$count" > "$FAKE_CURL_COUNTER"

if [ "$count" -eq 1 ]; then
  printf '{"errors":[{"message":"Unique constraint failed on the fields: (\\\`email\\\`)"}]}' > "$output_file"
else
  printf '{"data":{"createCustomer":{"id":"customer-2","name":"Cliente Carga 2","email":"load-test-test-run-2@example.com","cpf":"12345678909"}}}' > "$output_file"
fi

printf '200'
`,
      "utf8",
    );
    chmodSync(curlPath, 0o755);

    try {
      const result = spawnSync(
        "bash",
        [join(root, "scripts/create-customers.sh")],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            API_URL: "http://fake/graphql",
            CPF_SEED: "100000000",
            FAKE_CURL_COUNTER: counterPath,
            PATH: `${tempDir}:${process.env.PATH ?? ""}`,
            RUN_ID: "test-run",
            SLEEP_SECONDS: "0",
            TOTAL: "2",
          },
        },
      );

      expect(result.status).toBe(0);
      expect(result.stderr).toContain("[1/2] GraphQL error");
      expect(result.stderr).toContain("Unique constraint failed");
      expect(result.stdout).toContain(
        "[2/2] created load-test-test-run-2@example.com",
      );
      expect(result.stdout).toContain(
        "Finished customer creation load. created=1 failed=1 total=2",
      );
      expect(readFileSync(counterPath, "utf8").trim()).toBe("2");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
