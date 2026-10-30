# # important installs ------------------------------------------------ 
# # pip install pymupdf spacy sentence-transformers faiss-cpu
# # python -m spacy download en_core_web_sm
# # -------------------------------------------------------------------


# # jaroori library imports
# import fitz
# import re
# # import json
# # import spacy
# import numpy as np
# # import faiss

# from collections import Counter
# from sentence_transformers import SentenceTransformer




# def extract_clean_text(pdf_path):
#     text = []

#     with fitz.open(pdf_path) as doc:
#         for page in doc:
#             blocks = page.get_text("blocks")
#             blocks.sort(key=lambda b: (b[1], b[0]))

#             for block in blocks:
#                 block_text = block[4].strip()
#                 if len(block_text) < 3:
#                     continue
#                 text.append(block_text)

#     return "\n".join(text)


# def remove_repeated_lines(text):
#     lines = text.split("\n")
#     freq = Counter(lines)

#     cleaned = []
#     for line in lines:
#         if freq[line] > 5 and len(line.split()) < 3:
#             continue
#         cleaned.append(line)

#     return "\n".join(cleaned)


# raw = extract_clean_text("ML_Preprocessor_scripts/kp_resume.pdf")
# # final text from resume PDF
# final_text = remove_repeated_lines(raw)

# # print(final_text)


# # temp skills list(not a necessaty but good if i have a set for reference)
# skills_list = [
# # Programming Languages
# "python","java","c","c++","c#","javascript","typescript","go","rust","kotlin","swift","php","ruby","r","matlab","scala","dart","perl","haskell","objective-c",
# # Web Development
# "html","css","sass","tailwind","bootstrap","react","angular","vue","next.js","nuxt.js","node.js","express.js","django","flask","spring boot","asp.net","jquery","redux","graphql","rest api",
# # Mobile Development
# "android development","ios development","react native","flutter","xamarin","jetpack compose","swiftui","kotlin multiplatform",
# # Databases
# "mysql","postgresql","sqlite","mongodb","firebase","oracle","redis","cassandra","dynamodb","neo4j","elasticsearch","mariadb","cockroachdb",
# # Data Science / ML / AI
# "machine learning","deep learning","nlp","computer vision","data science","data analysis","data mining","data visualization","pandas","numpy","scikit-learn","tensorflow","keras","pytorch","opencv","xgboost","lightgbm","statsmodels","seaborn","matplotlib",
# # Big Data
# "hadoop","spark","pyspark","kafka","hive","flink","airflow","databricks",
# # DevOps & Cloud
# "aws","azure","google cloud","docker","kubernetes","terraform","ansible","jenkins","github actions","gitlab ci","circleci","cloud computing","devops","ci/cd","infrastructure as code",
# # Operating Systems & Networking
# "linux","unix","windows server","networking","tcp/ip","http","https","dns","dhcp","vpn","firewalls","load balancing","network security",
# # Cybersecurity
# "cybersecurity","ethical hacking","penetration testing","cryptography","encryption","network security","owasp","siem","malware analysis","reverse engineering",
# # Software Engineering Core
# "data structures","algorithms","object oriented programming","functional programming","design patterns","system design","low level design","high level design","software development lifecycle","agile","scrum","kanban","debugging","testing","unit testing","integration testing","test automation","clean code","refactoring",
# # Tools & Platforms
# "git","github","gitlab","bitbucket","jira","confluence","postman","swagger","vscode","intellij","eclipse","android studio","xcode","figma","adobe xd",
# # Backend Concepts
# "microservices","monolithic architecture","api development","authentication","authorization","jwt","oauth","web sockets","caching","rate limiting",
# # Frontend Concepts
# "responsive design","ui/ux","web performance","accessibility","seo","cross browser compatibility",
# # Embedded / Hardware / IoT
# "arduino","raspberry pi","embedded systems","iot","sensor interfacing","microcontrollers","verilog","vhdl","fpga","robotics","3d printing",
# # Game Dev / AR-VR
# "unity","unreal engine","game development","vr development","ar development","blender","3d modeling","shader programming","physics engine",
# # Blockchain / Web3
# "blockchain","smart contracts","solidity","web3","ethereum","hyperledger",
# # Data Engineering
# "etl","data warehousing","data pipelines","snowflake","redshift","bigquery",
# # Soft Skills (important for real resumes too)
# "problem solving","critical thinking","communication","teamwork","leadership","time management","adaptability","collaboration",
# # Misc / Industry Tools
# "excel","tableau","power bi","notion","slack","trello","zapier",
# # Advanced / Niche
# "reinforcement learning","gan","transformers","llm","prompt engineering","computer graphics","parallel computing","distributed systems","edge computing","quantum computing"
# ]



# def extract_skills(text, skills_db):
#     text = text.lower()
#     found_skills = set()

#     for skill in skills_db:
#         if re.search(r'\b' + re.escape(skill.lower()) + r'\b', text):
#             found_skills.add(skill)

#     return list(found_skills)

# # final list of skills 
# extracted_skills_list = extract_skills(final_text, skills_list)

# print(extracted_skills_list)
















import re

SKILLS_DB = [
    # Programming Languages
    "python","java","c","c++","c#","javascript","typescript","go","rust",
    "kotlin","swift","php","ruby","r","matlab","scala","dart","perl",
    "haskell","objective-c",
    # Web Development
    "html","css","sass","tailwind","bootstrap","react","angular","vue",
    "next.js","nuxt.js","node.js","express.js","django","flask",
    "spring boot","asp.net","jquery","redux","graphql","rest api",
    # Mobile Development
    "android development","ios development","react native","flutter",
    "xamarin","jetpack compose","swiftui","kotlin multiplatform",
    # Databases
    "mysql","postgresql","sqlite","mongodb","firebase","oracle","redis",
    "cassandra","dynamodb","neo4j","elasticsearch","mariadb","cockroachdb",
    # Data Science / ML / AI
    "machine learning","deep learning","nlp","computer vision","data science",
    "data analysis","data mining","data visualization","pandas","numpy",
    "scikit-learn","tensorflow","keras","pytorch","opencv","xgboost",
    "lightgbm","statsmodels","seaborn","matplotlib",
    # Big Data
    "hadoop","spark","pyspark","kafka","hive","flink","airflow","databricks",
    # DevOps & Cloud
    "aws","azure","google cloud","docker","kubernetes","terraform","ansible",
    "jenkins","github actions","gitlab ci","circleci","cloud computing",
    "devops","ci/cd","infrastructure as code",
    # OS & Networking
    "linux","unix","windows server","networking","tcp/ip","http","https",
    "dns","dhcp","vpn","firewalls","load balancing","network security",
    # Cybersecurity
    "cybersecurity","ethical hacking","penetration testing","cryptography",
    "encryption","owasp","siem","malware analysis","reverse engineering",
    # Software Engineering Core
    "data structures","algorithms","object oriented programming",
    "functional programming","design patterns","system design",
    "low level design","high level design","software development lifecycle",
    "agile","scrum","kanban","debugging","testing","unit testing",
    "integration testing","test automation","clean code","refactoring",
    # Tools & Platforms
    "git","github","gitlab","bitbucket","jira","confluence","postman",
    "swagger","vscode","intellij","eclipse","android studio","xcode",
    "figma","adobe xd",
    # Backend Concepts
    "microservices","monolithic architecture","api development",
    "authentication","authorization","jwt","oauth","web sockets",
    "caching","rate limiting",
    # Frontend Concepts
    "responsive design","ui/ux","web performance","accessibility","seo",
    "cross browser compatibility",
    # Embedded / IoT
    "arduino","raspberry pi","embedded systems","iot","sensor interfacing",
    "microcontrollers","verilog","vhdl","fpga","robotics","3d printing",
    # Game Dev / AR-VR
    "unity","unreal engine","game development","vr development",
    "ar development","blender","3d modeling","shader programming",
    "physics engine",
    # Blockchain / Web3
    "blockchain","smart contracts","solidity","web3","ethereum","hyperledger",
    # Data Engineering
    "etl","data warehousing","data pipelines","snowflake","redshift","bigquery",
    # Soft Skills
    "problem solving","critical thinking","communication","teamwork",
    "leadership","time management","adaptability","collaboration",
    # Misc / Industry Tools
    "excel","tableau","power bi","notion","slack","trello","zapier",
    # Advanced / Niche
    "reinforcement learning","gan","transformers","llm","prompt engineering",
    "computer graphics","parallel computing","distributed systems",
    "edge computing","quantum computing",
]


def extract_skills(text: str, skills_db: list = SKILLS_DB) -> list[str]:
    text_lower = text.lower()
    found = set()

    for skill in skills_db:
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found.add(skill)

    return list(found)