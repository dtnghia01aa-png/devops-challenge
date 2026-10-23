# Problem 2: Diagnose Me Doctor

## How to find the problem

```bash
df -h /; df -i /                            # is the disk full, or out of file slots (inodes)?
sudo du -xh -d2 / | sort -rh | head -20     # which folders are biggest
sudo lsof +L1                               # deleted files that are still open
sudo du -sh /var/log/nginx /var/lib/nginx   # nginx logs and temp files
sudo journalctl --disk-usage                # system logs
systemctl status logrotate                  # did log cleanup fail?
lsblk; sudo vgs                             # is / smaller than the 64 GB disk?
```

If `df` says the disk is full but `du` cannot find the files, nginx is still holding a deleted log.
Run `sudo nginx -s reopen` to free it.

## Possible causes

| Cause | What happens | Quick fix | Long-term fix |
| --- | --- | --- | --- |
| nginx logs never cleaned | Disk fills slowly | `truncate -s 0` the log | Rotate logs every hour with a size limit |
| nginx keeps writing to an old log | Old log keeps growing | `nginx -s reopen` | Test the log rotation script |
| Many errors from a broken server | Disk fills fast | Empty `error.log` | Log only warnings; fix the server |
| Cache has no size limit | Cache fills the disk | Empty the cache folder | Set `max_size` |
| Big uploads or downloads | Uploads fail, downloads break | Reload nginx | Limit upload and temp file size |
| System logs grow | Disk fills | `journalctl --vacuum-size=200M` | Set `SystemMaxUse=500M` |
| Too many small files | No new files, even with free space | Delete the small files | Stop what creates them |
| Log sender cannot send | Logs pile up on disk | Clear its queue | Limit its buffer size |
| `/` does not use the whole disk | Disk is smaller than expected | `lvextend -r -l +100%FREE` | Use the full disk at install |

## Effect on the load balancer

- nginx cannot write logs or temp files. Uploads fail and big downloads break.
- Health checks still pass, so the problem is easy to miss.

## Fix safely

- Free space first without stopping nginx: clean system logs, run `apt-get clean`, grow `/` if possible.
- Empty open logs with `truncate`. Never `rm` them: deleting a file nginx still uses frees nothing.

## Stop it happening again

- Alert on disk use, file slots and how fast the disk fills.
- Send logs to another server, and keep `/var/log` on its own disk.
