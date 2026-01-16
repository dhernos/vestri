import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              // import Source which should be blocked
              name: "next/navigation",
              // forbidden imports
              importNames: [
                "useRouter",
                "redirect",
                "permanentRedirect",
                "usePathname",
              ],
              message: "Please use hooks and functions from 'next-intl'.",
            },
            {
              name: "@prisma/client",
              message:
                "Direkte Imports von '@prisma/client' sind nicht erlaubt. Verwenden Sie stattdessen den eingerichteten Datenzugriffsdienst.",
            },
            {
              name: "ioredis",
              message:
                "Direkte Imports von 'ioredis' sind nicht erlaubt. Verwenden Sie stattdessen den Redis-Service oder eine Wrapper-Funktion.",
            },
          ],
        },
      ],
      "react/no-danger": "error",
    },
  },
];

export default eslintConfig;
