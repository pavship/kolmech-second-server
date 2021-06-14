 SELECT m.id,
	-- m.datetime,
	m.from_amo_id amo_id,
	m.from_inn inn,
	-- m.from_proj_id,
	-- m.from_task_id,
	-- m.from_store_id,
	m.to_amo_id counterparty_amo_id,
	m.to_inn counterparty_inn,
	-- m.to_proj_id,
	-- m.to_task_id,
	-- m.to_store_id,
	m.proj_id,
	m.task_id,
	m.amount,
	m.paid,
	-- m.created_at,
	-- m.created_by,
	-- m.updated_at,
	-- m.updated_by,
	-- m.qty,
	-- m.compensation_for,
	m.transfer_id,
	COALESCE(compensation.id, m.compensation_for) compensation_id,
	COALESCE(t.datetime, EXTRACT(EPOCH FROM m.created_at)::int) datetime
FROM move m
LEFT JOIN transfer t ON t.id = m.transfer_id
LEFT JOIN move compensation ON compensation.compensation_for = m.id