-- 两个触发器函数没有固定 search_path（Supabase 安全检查 function_search_path_mutable）。
-- 函数体里的表名都已带 schema，置空即可。

alter function public.credit_aliases_no_chain() set search_path = '';
alter function public.users_guard_can_stream() set search_path = '';
