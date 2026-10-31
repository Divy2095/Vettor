-- ============================================================================
-- VETTOR PLATFORM MIGRATION - FILE 05: SEED CURATED QUESTIONS
-- Description: Seeds the core curated interview question bank (derived from
--              ML_Preprocessor_scripts/data/questions.json) into public.questions.
--              Safely repeatable using WHERE NOT EXISTS (question_text, topic).
-- Target: Supabase PostgreSQL 15+
-- ============================================================================

INSERT INTO public.questions (question_text, topic, difficulty, tags, source_type, is_active)
SELECT v.question_text, v.topic, v.difficulty, v.tags, v.source_type, v.is_active
FROM (VALUES
    ('What is the difference between HTML elements and tags?', 'HTML', 'Easy', ARRAY['html', 'web fundamentals'], 'curated_dataset', true),
    ('Define the HTML5 Semantic Elements and why they are important for SEO and accessibility.', 'HTML', 'Medium', ARRAY['html5', 'semantics', 'seo', 'accessibility'], 'curated_dataset', true),
    ('Explain the CSS Box Model and how box-sizing: border-box changes it.', 'CSS', 'Easy', ARRAY['css', 'box-model', 'layout'], 'curated_dataset', true),
    ('Explain the difference between flexbox and CSS Grid. When would you choose one over the other?', 'CSS', 'Medium', ARRAY['css', 'flexbox', 'grid', 'responsive-design'], 'curated_dataset', true),
    ('What is event delegation in JavaScript and why is it useful?', 'JavaScript', 'Medium', ARRAY['javascript', 'dom', 'events', 'performance'], 'curated_dataset', true),
    ('Explain the event loop, call stack, and task queue in JavaScript.', 'JavaScript', 'Hard', ARRAY['javascript', 'event-loop', 'concurrency', 'asynchronous'], 'curated_dataset', true),
    ('What is the difference between synchronous and asynchronous code in Node.js?', 'Node.js', 'Easy', ARRAY['node.js', 'async', 'backend'], 'curated_dataset', true),
    ('Given an array of integers, find two numbers that add up to a target sum (Two Sum).', 'DSA', 'Easy', ARRAY['dsa', 'arrays', 'hash-table', '2-pointers'], 'curated_dataset', true),
    ('How would you detect a cycle in a singly linked list?', 'DSA', 'Medium', ARRAY['dsa', 'linked-list', 'fast-slow-pointers'], 'curated_dataset', true),
    ('Explain the difference between a process and a thread in modern operating systems.', 'OS', 'Medium', ARRAY['os', 'concurrency', 'multithreading', 'processes'], 'curated_dataset', true),
    ('What are the ACID properties in database management systems?', 'Database', 'Medium', ARRAY['database', 'sql', 'transactions', 'acid'], 'curated_dataset', true),
    ('Explain the difference between clustered and non-clustered indexes in SQL.', 'Database', 'Hard', ARRAY['database', 'indexing', 'b-tree', 'sql-optimization'], 'curated_dataset', true),
    ('Describe the 3-way handshake in the TCP connection establishment protocol.', 'Networking', 'Medium', ARRAY['networking', 'tcp', 'protocols', 'handshake'], 'curated_dataset', true),
    ('What happens in the browser from the moment you type a URL until the page renders?', 'Networking', 'Hard', ARRAY['networking', 'dns', 'http', 'browser-rendering'], 'curated_dataset', true)
) AS v(question_text, topic, difficulty, tags, source_type, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.questions q
    WHERE q.question_text = v.question_text
      AND q.topic = v.topic
);

COMMENT ON TABLE public.questions IS 'Seeded with representative curated question dataset. Full dataset questions can be synced via scripts/seed-questions.js';
