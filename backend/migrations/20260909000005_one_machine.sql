-- One public machine for the walk-up demo: Yaba / CN-MACHINE-001.
UPDATE collection_points
SET status = 'inactive'
WHERE id = '00000000-0000-7000-8000-000000000021';

UPDATE devices
SET status = 'disabled'
WHERE id = '00000000-0000-7000-8000-000000000031';
