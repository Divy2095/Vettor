SKILL_ONTOLOGY = {
    "java":                     ["OOP", "JVM", "multithreading", "collections", "DSA", "SOLID principles"],
    "python":                   ["OOP", "data structures", "scripting", "list comprehension"],
    "c++":                      ["OOP", "pointers", "memory management", "STL", "DSA"],
    "javascript":               ["DOM", "async", "promises", "ES6", "closures", "event loop"],
    "typescript":               ["javascript", "static typing", "interfaces", "OOP"],
    "react":                    ["javascript", "hooks", "state management", "component lifecycle", "virtual DOM"],
    "next.js":                  ["react", "javascript", "SSR", "routing", "API routes"],
    "node.js":                  ["javascript", "REST API", "event loop", "async", "npm"],
    "express.js":               ["REST API", "middleware", "routing", "node.js"],
    "django":                   ["python", "REST API", "ORM", "MVC", "web framework"],
    "flask":                    ["python", "REST API", "routing", "web framework"],
    "spring boot":              ["java", "REST API", "dependency injection", "microservices"],
    "mongodb":                  ["NoSQL", "document store", "aggregation pipeline", "indexing"],
    "mysql":                    ["SQL", "joins", "normalization", "indexing", "ACID", "DBMS"],
    "postgresql":               ["SQL", "joins", "indexing", "ACID", "DBMS", "transactions"],
    "redis":                    ["caching", "key-value store", "pub/sub", "in-memory database"],
    "machine learning":         ["supervised learning", "unsupervised learning", "overfitting", "bias variance", "feature engineering"],
    "deep learning":            ["machine learning", "neural networks", "backpropagation", "gradient descent", "activation functions"],
    "pytorch":                  ["deep learning", "tensors", "autograd", "neural networks", "model training"],
    "tensorflow":               ["deep learning", "neural networks", "keras", "model training", "computation graphs"],
    "nlp":                      ["text processing", "tokenization", "embeddings", "transformers", "language models"],
    "computer vision":          ["image processing", "convolutional neural networks", "object detection", "opencv"],
    "data science":             ["statistics", "data analysis", "visualization", "machine learning", "pandas", "numpy"],
    "docker":                   ["containerization", "DevOps", "microservices", "virtualization", "images", "containers"],
    "kubernetes":               ["container orchestration", "docker", "DevOps", "scaling", "pods", "microservices"],
    "aws":                      ["cloud computing", "EC2", "S3", "DevOps", "scalability", "IAM"],
    "git":                      ["version control", "branching", "merging", "pull requests", "collaboration"],
    "system design":            ["scalability", "load balancing", "caching", "CAP theorem", "databases", "microservices"],
    "data structures":          ["arrays", "linked lists", "trees", "graphs", "stacks", "queues", "hashing"],
    "algorithms":               ["sorting", "searching", "dynamic programming", "recursion", "time complexity", "space complexity"],
    "object oriented programming": ["classes", "inheritance", "polymorphism", "encapsulation", "abstraction", "SOLID"],
    "linux":                    ["OS", "shell scripting", "file system", "processes", "permissions", "bash"],
    "networking":               ["TCP/IP", "HTTP", "DNS", "OSI model", "sockets", "protocols"],
    "cybersecurity":            ["encryption", "authentication", "vulnerabilities", "OWASP", "penetration testing"],
    "agile":                    ["scrum", "sprints", "kanban", "user stories", "retrospectives"],
    "microservices":            ["REST API", "docker", "kubernetes", "API gateway", "distributed systems"],
    "firebase":                 ["NoSQL", "real-time database", "authentication", "cloud functions", "google cloud"],
    "graphql":                  ["API development", "queries", "mutations", "schema", "REST API comparison"],
    "react native":             ["react", "javascript", "mobile development", "cross platform"],
    "flutter":                  ["dart", "mobile development", "cross platform", "widgets"],
    "reinforcement learning":   ["machine learning", "reward function", "policy", "Q-learning", "agent environment"],
    "transformers":             ["deep learning", "attention mechanism", "NLP", "BERT", "GPT", "embeddings"],
    "llm":                      ["transformers", "NLP", "prompt engineering", "fine-tuning", "language models"],
    "blockchain":               ["distributed systems", "cryptography", "consensus", "smart contracts", "decentralization"],
}


def expand_skills(skills: list[str]) -> list[str]:
    expanded = set(skills)

    for skill in skills:
        key = skill.lower().strip()
        if key in SKILL_ONTOLOGY:
            expanded.update(SKILL_ONTOLOGY[key])

    return list(expanded)