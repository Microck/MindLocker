import json
import sys
import os
import platform
import ctypes
import subprocess
import shutil
from datetime import datetime, timezone

# --- Constants & Config (Unchanged) ---
APP_NAME = "MindLocker"
HOSTS_FILE_BACKUP_NAME = f"hosts.{APP_NAME.lower()}_original.bak"
SITES_CONFIG = {
    "Social Media": {"Twitter/X": ["twitter.com", "x.com"], "Instagram": ["instagram.com"], "Facebook": ["facebook.com"], "Reddit": ["reddit.com"], "LinkedIn": ["linkedin.com"], "TikTok": ["tiktok.com"], "Pinterest": ["pinterest.com"], "Threads": ["threads.net"]},
    "Communication": {"Discord": ["discord.com", "cdn.discordapp.com"], "WhatsApp Web": ["web.whatsapp.com"], "Telegram Web": ["web.telegram.org"]},
    "Streaming & Video": {"YouTube": ["youtube.com", "m.youtube.com"], "Netflix": ["netflix.com"], "Twitch": ["twitch.tv"]},
    "News": {"CNN": ["cnn.com"], "BBC News": ["bbc.com"], "NY Times": ["nytimes.com"]},
    "General Distractions": {"9gag": ["9gag.com"]}
}
BLOCK_IP = "127.0.0.1"
BLOCK_MARKER_START = f"# BEGIN {APP_NAME} BLOCK"
BLOCK_MARKER_END = f"# END {APP_NAME} BLOCK"
# New marker to store the session end time directly in the hosts file
END_TIME_MARKER = f"# {APP_NAME}_END_TIME_ISO:"

# --- Helper Functions ---
def get_hosts_file_path():
    return r"C:\Windows\System32\drivers\etc\hosts" if platform.system() == "Windows" else "/etc/hosts"

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0 if platform.system() == "Windows" else os.geteuid() == 0
    except: return False

def flush_dns():
    try:
        if platform.system() == "Windows": subprocess.run(["ipconfig", "/flushdns"], check=True, capture_output=True)
    except: pass # Ignore errors if flush fails

def get_domains_from_keys(site_keys):
    domains = set()
    flat_sites = {name: urls for category in SITES_CONFIG.values() for name, urls in category.items()}
    for key in site_keys:
        if key in flat_sites:
            # Add www. subdomain for broader blocking
            for domain in flat_sites[key]:
                domains.add(domain)
                if not domain.startswith("www."):
                    domains.add(f"www.{domain}")
    return list(domains)

def actual_block_sites(domains_to_block, end_time_iso):
    hosts_file_path = get_hosts_file_path()
    hosts_backup_path = os.path.join(os.path.dirname(hosts_file_path), HOSTS_FILE_BACKUP_NAME)
    try:
        if not os.path.exists(hosts_backup_path): shutil.copy2(hosts_file_path, hosts_backup_path)
        with open(hosts_backup_path, 'r', encoding='utf-8') as f_backup: original_lines = f_backup.readlines()
        
        block_entries = [f"\n{BLOCK_MARKER_START}\n"]
        block_entries.append(f"{END_TIME_MARKER} {end_time_iso}\n") # Store end time
        for domain in domains_to_block: block_entries.append(f"{BLOCK_IP}\t{domain}\n")
        block_entries.append(f"{BLOCK_MARKER_END}\n")

        with open(hosts_file_path, 'w', encoding='utf-8') as f_hosts:
            f_hosts.writelines(original_lines)
            f_hosts.writelines(block_entries)
        flush_dns()
        return True, "Sites blocked successfully."
    except Exception as e: return False, f"Error modifying hosts file: {e}"

def actual_unblock_sites():
    hosts_file_path = get_hosts_file_path()
    hosts_backup_path = os.path.join(os.path.dirname(hosts_file_path), HOSTS_FILE_BACKUP_NAME)
    try:
        if os.path.exists(hosts_backup_path):
            shutil.copy2(hosts_backup_path, hosts_file_path)
            os.remove(hosts_backup_path)
        else: # Fallback if backup is missing
            with open(hosts_file_path, 'r', encoding='utf-8') as f: lines = f.readlines()
            new_lines = []; in_block = False
            for line in lines:
                if BLOCK_MARKER_START in line: in_block = True; continue
                if BLOCK_MARKER_END in line: in_block = False; continue
                if not in_block: new_lines.append(line)
            with open(hosts_file_path, 'w', encoding='utf-8') as f: f.writelines(new_lines)
        flush_dns()
        return True, "Sites unblocked successfully."
    except Exception as e: return False, f"Error restoring hosts file: {e}"

def get_session_status():
    hosts_file_path = get_hosts_file_path()
    try:
        with open(hosts_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith(END_TIME_MARKER):
                    end_time_iso = line.strip().split(" ", 1)[1]
                    # Check if time has already passed
                    if datetime.now(timezone.utc) >= datetime.fromisoformat(end_time_iso):
                        return {"is_blocking": False, "end_time_iso": None}
                    return {"is_blocking": True, "end_time_iso": end_time_iso}
        return {"is_blocking": False, "end_time_iso": None}
    except FileNotFoundError:
        return {"is_blocking": False, "end_time_iso": None}
    except Exception:
        return {"is_blocking": False, "end_time_iso": None}

# --- Command Processor ---
def process_command(command_data):
    action = command_data.get("action")
    payload = command_data.get("payload", {})
    
    if action == "admin_check":
        return {"success": True, "is_admin": is_admin()}
    
    if not is_admin():
        return {"success": False, "error": "Backend requires admin privileges."}

    if action == "get_status":
        status = get_session_status()
        return {"success": True, **status}

    elif action == "start_session":
        from datetime import timedelta
        duration_minutes = payload.get("duration_minutes", 15)
        site_keys = payload.get("site_keys_to_block", [])
        domains = get_domains_from_keys(site_keys)
        if not domains:
            return {"success": False, "error": "No valid domains selected."}
        
        end_time = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
        end_time_iso = end_time.isoformat()
        
        success, message = actual_block_sites(domains, end_time_iso)
        if success:
            return {"success": True, "message": message, "end_time_iso": end_time_iso}
        else:
            return {"success": False, "error": message}

    elif action == "unblock":
        success, message = actual_unblock_sites()
        return {"success": success, "message": message}
    else:
        return {"success": False, "error": f"Unknown action: {action}"}

# --- Main Execution Loop ---
def main():
    for line in sys.stdin:
        try:
            command = json.loads(line.strip())
            response = process_command(command)
        except Exception as e:
            response = {"success": False, "error": f"Python script error: {str(e)}"}
        print(json.dumps(response), flush=True)

if __name__ == "__main__":
    main()