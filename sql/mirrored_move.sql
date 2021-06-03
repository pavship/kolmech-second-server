SELECT m.id,
	m.amo_id,
	m.inn,
	m.counterparty_amo_id,
	m.counterparty_inn,
	m.proj_id,
	m.task_id,
	m.amount,
	m.paid,
	m.transfer_id,
	m.compensation_id,
	m.datetime
FROM constricted_move m
UNION ALL
SELECT m.id,
	m.counterparty_amo_id,
	m.counterparty_inn,
	m.amo_id,
	m.inn,
	m.proj_id,
	m.task_id,
	-m.amount,
	-m.paid,
	m.transfer_id,
	m.compensation_id,
	m.datetime
FROM constricted_move m
ORDER BY id