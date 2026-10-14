import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
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
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react/no-danger": "error",
    },
  },
];

export default eslintConfig;
