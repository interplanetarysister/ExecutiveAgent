-- Open courseware entries researched 2026-11-27 (Michelle Rogers Executive Agent).
-- 29 free college/university courses across 8 subject areas; every URL was
-- confirmed against a live page during research. Idempotent: rows whose
-- source_url already exists are skipped. Companion report:
-- OPEN-COURSEWARE-RESEARCH.md (goal workspace) and MISSION_1 in this folder.

-- 1) Research table (console Research tab reads public.executive_research)
insert into public.executive_research (title, kind, source_url, verified, retrieved_at)
select v.title, 'open-courseware', v.url, true, now()
from (values
('CS50x: Introduction to Computer Science — Harvard University','https://cs50.harvard.edu/x/2019/'),
('6.0001 Introduction to Computer Science and Programming in Python — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/resources/lecture-notes/'),
('CS61A: The Structure and Interpretation of Computer Programs — University of California, Berkeley','https://cs61a.org/fa26/syllabus/'),
('CS106A: Programming Methodology — Stanford University','https://see.stanford.edu/Course/CS106A/191'),
('Full Stack Open — University of Helsinki','https://fullstackopen.com/en/part0/general_info/'),
('CS50''s Web Programming with Python and JavaScript — Harvard University','https://harvardonline.harvard.edu/course/cs50s-web-programming-python-javascript'),
('6.005 Elements of Software Construction — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/6-005-elements-of-software-construction-fall-2008/'),
('CS229: Machine Learning — Stanford University','https://cs229.stanford.edu/index.html-backup-fall21'),
('6.036 Introduction to Machine Learning — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/'),
('CS50''s Introduction to Artificial Intelligence with Python — Harvard University','https://cs50.harvard.edu/ai/'),
('CS224N: Natural Language Processing with Deep Learning — Stanford University','https://web.stanford.edu/class/cs224n/'),
('CS294/194-196: Large Language Model Agents (MOOC) — University of California, Berkeley','https://rdi.berkeley.edu/llm-agents/f24'),
('Data 8: The Foundations of Data Science — University of California, Berkeley','https://data8.org/'),
('Statistical Reasoning (Open & Free) — Carnegie Mellon University','https://oli.cmu.edu/courses/statistical-reasoning-copy/'),
('Probability & Statistics (Open & Free) — Carnegie Mellon University','https://oli.cmu.edu/courses/probability-statistics-open-free/'),
('Introductory Statistics 2e (textbook) — Rice University (OpenStax)','https://openstax.org/details/books/introductory-statistics-2e'),
('DevOps with Docker — University of Helsinki','https://github.com/mamelukki/docker-hy.github.io'),
('DevOps with Kubernetes — University of Helsinki','https://courses.mooc.fi/org/uh-cs/courses/devops-with-kubernetes-2026'),
('6.824 Distributed Computer Systems Engineering — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/6-824-distributed-computer-systems-engineering-spring-2006/pages/syllabus/'),
('CS50''s Introduction to Cybersecurity — Harvard University','https://harvardonline.harvard.edu/course/cs50s-introduction-cybersecurity'),
('6.858 Computer Systems Security — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/6-858-computer-systems-security-fall-2014/'),
('CS155: Computer and Network Security — Stanford University','https://cs155.stanford.edu/syllabus.html'),
('15.390 New Enterprises — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/15-390-new-enterprises-spring-2013/'),
('ECON 252: Financial Markets — Yale University','https://online.yale.edu/courses/financial-markets'),
('Entrepreneurship (textbook) — Rice University (OpenStax)','https://openstax.org/details/books/entrepreneurship'),
('Entrepreneurship Specialization (Wharton) — University of Pennsylvania','https://www.classcentral.com/course/wharton-entrepreneurship-18932'),
('6.042J Mathematics for Computer Science — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-fall-2010/'),
('18.06 Linear Algebra — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/'),
('18.01 Single Variable Calculus — Massachusetts Institute of Technology','https://ocw.mit.edu/courses/18-01-single-variable-calculus-fall-2006/pages/syllabus/')
) as v(title, url)
where not exists (select 1 from public.executive_research r where r.source_url = v.url);

-- 2) Knowledge table (console Knowledge tab reads executive.knowledge)
insert into executive.knowledge (department, topic, title, verification)
select 'Open Courseware', v.subject, v.title, 'source-checked'
from (values
('Computer Science & Programming Fundamentals','CS50x: Introduction to Computer Science — Harvard University'),
('Computer Science & Programming Fundamentals','6.0001 Introduction to Computer Science and Programming in Python — Massachusetts Institute of Technology'),
('Computer Science & Programming Fundamentals','CS61A: The Structure and Interpretation of Computer Programs — University of California, Berkeley'),
('Computer Science & Programming Fundamentals','CS106A: Programming Methodology — Stanford University'),
('Software Engineering & Full-Stack Web Development','Full Stack Open — University of Helsinki'),
('Software Engineering & Full-Stack Web Development','CS50''s Web Programming with Python and JavaScript — Harvard University'),
('Software Engineering & Full-Stack Web Development','6.005 Elements of Software Construction — Massachusetts Institute of Technology'),
('Artificial Intelligence & Machine Learning','CS229: Machine Learning — Stanford University'),
('Artificial Intelligence & Machine Learning','6.036 Introduction to Machine Learning — Massachusetts Institute of Technology'),
('Artificial Intelligence & Machine Learning','CS50''s Introduction to Artificial Intelligence with Python — Harvard University'),
('Artificial Intelligence & Machine Learning','CS224N: Natural Language Processing with Deep Learning — Stanford University'),
('Artificial Intelligence & Machine Learning','CS294/194-196: Large Language Model Agents (MOOC) — University of California, Berkeley'),
('Data Science & Statistics','Data 8: The Foundations of Data Science — University of California, Berkeley'),
('Data Science & Statistics','Statistical Reasoning (Open & Free) — Carnegie Mellon University'),
('Data Science & Statistics','Probability & Statistics (Open & Free) — Carnegie Mellon University'),
('Data Science & Statistics','Introductory Statistics 2e (textbook) — Rice University (OpenStax)'),
('Cloud Computing & DevOps','DevOps with Docker — University of Helsinki'),
('Cloud Computing & DevOps','DevOps with Kubernetes — University of Helsinki'),
('Cloud Computing & DevOps','6.824 Distributed Computer Systems Engineering — Massachusetts Institute of Technology'),
('Cybersecurity Fundamentals','CS50''s Introduction to Cybersecurity — Harvard University'),
('Cybersecurity Fundamentals','6.858 Computer Systems Security — Massachusetts Institute of Technology'),
('Cybersecurity Fundamentals','CS155: Computer and Network Security — Stanford University'),
('Entrepreneurship, Business & Fundraising','15.390 New Enterprises — Massachusetts Institute of Technology'),
('Entrepreneurship, Business & Fundraising','ECON 252: Financial Markets — Yale University'),
('Entrepreneurship, Business & Fundraising','Entrepreneurship (textbook) — Rice University (OpenStax)'),
('Entrepreneurship, Business & Fundraising','Entrepreneurship Specialization (Wharton) — University of Pennsylvania'),
('Mathematics for Computer Science','6.042J Mathematics for Computer Science — Massachusetts Institute of Technology'),
('Mathematics for Computer Science','18.06 Linear Algebra — Massachusetts Institute of Technology'),
('Mathematics for Computer Science','18.01 Single Variable Calculus — Massachusetts Institute of Technology')
) as v(subject, title)
where not exists (select 1 from executive.knowledge k where k.title = v.title and k.department = 'Open Courseware');
