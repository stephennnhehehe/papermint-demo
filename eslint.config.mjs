import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  },
  {
    files: ["src/components/pdf/**/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "off"
    }
  }
];

export default eslintConfig;
