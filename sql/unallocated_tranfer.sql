SELECT t.id, allocated, to_timestamp(t.datetime) datetime FROM transfer t
LEFT JOIN (
	SELECT transfer_id, SUM(paid) allocated FROM move GROUP BY transfer_id
) m ON m.transfer_id = t.id
WHERE amount - allocated > 0 OR allocated IS NULL