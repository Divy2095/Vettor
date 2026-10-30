const SKILL_PATTERNS = [
  "javascript",
  "typescript",
  "react",
  "next.js",
  "node.js",
  "express",
  "mongodb",
  "mongoose",
  "postgresql",
  "mysql",
  "redis",
  "docker",
  "kubernetes",
  "aws",
  "azure",
  "gcp",
  "git",
  "github",
  "gitlab",
  "rest api",
  "graphql",
  "tailwind css",
  "html",
  "css",
  "sass",
  "redux",
  "vite",
  "webpack",
  "jest",
  "cypress",
  "playwright",
  "python",
  "java",
  "c++",
  "c#",
  "go",
  "php",
  "laravel",
  "django",
  "flask",
  "machine learning",
  "deep learning",
  "nlp",
  "tensorflow",
  "pytorch",
  "pandas",
  "numpy",
  "scikit-learn",
  "data analysis",
  "microservices",
  "system design",
  "ci/cd",
  "agile",
  "jira",
  "linux",
  "bash",
  "oauth",
  "jwt",
  "firebase",
  "supabase",
  "figma",
];

const toRegexPattern = (skill) => {
  const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalizedSpaces = escapedSkill.replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9+.#])${normalizedSpaces}([^a-z0-9+.#]|$)`, "i");
};

const prettifySkill = (skill) =>
  skill
    .split(" ")
    .map((chunk) => {
      if (chunk === "node.js") return "Node.js";
      if (chunk === "next.js") return "Next.js";

      if (chunk === "aws" || chunk === "gcp" || chunk === "ci/cd" || chunk === "nlp") {
        return chunk.toUpperCase();
      }

      if (chunk.includes(".")) {
        return chunk
          .split(".")
          .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
          .join(".");
      }

      if (chunk.length <= 3) {
        return chunk.toUpperCase();
      }

      return chunk[0].toUpperCase() + chunk.slice(1);
    })
    .join(" ");

export const extractSkillsFromResumeText = (rawText) => {
  const text = rawText.toLowerCase();

  return SKILL_PATTERNS.filter((skill) => toRegexPattern(skill).test(text)).map(prettifySkill);
};
