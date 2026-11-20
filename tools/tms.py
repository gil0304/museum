#!/usr/bin/env python3
"""MUSEUM TMS bridge. Updates only G and J on verified rows."""
from __future__ import annotations
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

from google.auth.transport.requests import AuthorizedSession, Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'tools' / 'tms.config.json').read_text(encoding='utf8'))
ID = CONFIG['spreadsheet_id']
TAB = CONFIG['sheet_name']
START, END = CONFIG['start_row'], CONFIG['end_row']
SECRET = ROOT / '.secrets'
CACHE = ROOT / '.tms-cache' / 'tasks.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
API = f'https://sheets.googleapis.com/v4/spreadsheets/{ID}'


def oauth(force=False):
    SECRET.mkdir(parents=True, exist_ok=True)
    token = SECRET / 'token.json'
    creds_file = SECRET / 'credentials.json'
    creds = Credentials.from_authorized_user_file(str(token), SCOPES) if token.exists() and not force else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not creds_file.exists():
                raise RuntimeError('OAuthクライアントがありません: .secrets/credentials.json を配置してください（README参照）。')
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_file), SCOPES)
            creds = flow.run_local_server(port=0, open_browser=True)
        token.write_text(creds.to_json(), encoding='utf8')
        try: token.chmod(0o600)
        except OSError: pass
    return creds


def request(method, path, payload=None, params=None):
    s = AuthorizedSession(oauth())
    response = s.request(method, API + path, json=payload, params=params, timeout=40)
    if not response.ok:
        raise RuntimeError(f'Google Sheets API {response.status_code}: {response.text[:500]}')
    return response.json() if response.content else {}


def a1(rng):
    return '/values/' + quote(f"'{TAB}'!{rng}", safe='')


def read(rng):
    return request('GET', a1(rng)).get('values', [])


def cell(row, ix):
    return row[ix] if len(row)>ix else ''


def get_tasks():
    rows=read(f'C{START}:J{END}')
    tasks=[]
    for r in range(START, END + 1):
        v=rows[r-START] if r-START < len(rows) else []
        action=cell(v,1)
        if not action: continue
        tasks.append({'row':r,'category':cell(v,0),'action':action,'priority':cell(v,2),
                      'status':cell(v,3),'working':str(cell(v,4)).upper()=='TRUE',
                      'month':cell(v,5),'planned_week':cell(v,6),'done_week':cell(v,7)})
    return tasks


def cached():
    if not CACHE.exists(): raise RuntimeError('先に python tools/tms.py pull を実行してください。')
    return json.loads(CACHE.read_text(encoding='utf8'))['tasks']


def find_verified(row_number):
    local=next((t for t in cached() if t['row']==row_number),None)
    if not local: raise RuntimeError(f'行{row_number}はキャッシュにありません。pullで再確認してください。')
    current=next((t for t in get_tasks() if t['row']==row_number),None)
    if current is None or local['action'] != current['action']:
        raise RuntimeError('タスク本文が変更されたか行が移動しました。安全のため書き込みを停止しました。pullで確認してください。')
    return current


def write_cells(cells):
    body={'valueInputOption':'USER_ENTERED','data':[
        {'range':f"'{TAB}'!{column}{row}", 'values':[[value]]} for column,row,value in cells]}
    return request('POST','/values:batchUpdate',body)


def allowed_weeks(row):
    v=read(f'T{row}:AH{row}')
    return [str(x).strip() for x in (v[0] if v else []) if isinstance(x,str) and x.strip().startswith('第') and '週:' in x]


def infer_week(weeks, today=None):
    today=today or dt.date.today()
    pat=re.compile(r'第\d+週:(\d+)月(\d+)日\([^)]*\)\s*~\s*(\d+)月(\d+)日')
    for w in weeks:
        m=pat.search(w)
        if not m: continue
        sm,sd,em,ed=map(int,m.groups())
        start_year=2026 if sm>=11 else 2027
        end_year=start_year+(1 if em<sm else 0)
        if dt.date(start_year,sm,sd)<=today<=dt.date(end_year,em,ed):return w
    return None


def command_pull():
    tasks=get_tasks();CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps({'spreadsheet_id':ID,'sheet_name':TAB,'fetched_at':dt.datetime.now().isoformat(),'tasks':tasks},ensure_ascii=False,indent=2),encoding='utf8')
    print(f'取得完了: {len(tasks)}件 ({START}〜{END}行)。キャッシュ: {CACHE.relative_to(ROOT)}')


def main():
    p=argparse.ArgumentParser(description='MUSEUM TMS safe bridge')
    sub=p.add_subparsers(dest='command',required=True)
    sub.add_parser('auth');sub.add_parser('doctor');sub.add_parser('pull');sub.add_parser('status')
    nx=sub.add_parser('next');nx.add_argument('--limit',type=int,default=10)
    for name in ['start','done']:
        q=sub.add_parser(name);q.add_argument('row',type=int);q.add_argument('--dry-run',action='store_true')
        if name=='done':q.add_argument('--week',default=None)
    args=p.parse_args()
    if args.command=='auth':
        oauth();print('OAuth認証成功（.secrets/token.json に保存）');return
    if args.command=='doctor':
        meta=request('GET','',params={'fields':'spreadsheetId,properties(title),sheets(properties(sheetId,title))'})
        found=any(s['properties']['title']==TAB and s['properties']['sheetId']==CONFIG['sheet_gid'] for s in meta.get('sheets',[]))
        print(f"Spreadsheet: {meta.get('properties',{}).get('title')} | tab={TAB} | gid={CONFIG['sheet_gid']} | {'OK' if found else 'MISMATCH'}")
        if not found:raise RuntimeError('指定タブまたはgidが一致しません。書き込みを停止してください。')
        print('API読取:',len(get_tasks()),'タスク');return
    if args.command=='pull':command_pull();return
    if args.command in ('status','next'):
        ts=get_tasks()
        counts={name:sum(1 for t in ts if t['status']==name) for name in set(t['status'] for t in ts)}
        print(f'TMS {len(ts)}件:',counts)
        if args.command=='next':
            ts=[t for t in ts if not t['done_week'] and not t['working']][:args.limit]
        else: ts=[t for t in ts if t['working'] or t['done_week']][-15:]
        for t in ts:print(f"{t['row']:>3} | {t['status']:<5} | {t['category']} | {t['action']} | {t['planned_week']}")
        return
    if args.row<START or args.row>END:raise RuntimeError('指定行が許可範囲外です。')
    task=find_verified(args.row)
    if args.command=='start':
        if task['done_week']:raise RuntimeError('既に完了週があります。再開は手作業で確認してください。')
        if task['working']:print('すでに作業中です。');return
        updates=[('G',args.row,'TRUE')]
    else:
        if task['done_week']:print('すでに完了しています。');return
        if not task['working']:
            raise RuntimeError('先に start してください。テスト未実施の完了を防止します。')
        weeks=allowed_weeks(args.row)
        week=args.week or infer_week(weeks)
        if not week or week not in weeks:
            raise RuntimeError('現在日付に合う完了週が選択肢にありません。許容候補を表示します: '+repr(weeks))
        updates=[('J',args.row,week),('G',args.row,'FALSE')]
    print(f"対象: {args.row}行 {task['action']}")
    print('更新予定:',updates)
    if args.dry_run:print('DRY RUN: 書き込みなし');return
    result=write_cells(updates)
    print('Sheets更新:',result.get('totalUpdatedCells'),'セル')
    after=find_verified(args.row)
    if args.command=='start' and not after['working']:raise RuntimeError('書き込み検証失敗: G列がTRUEではありません。')
    if args.command=='done' and (after['working'] or not after['done_week']):raise RuntimeError('書き込み検証失敗: G/J列を確認してください。')
    command_pull()
    print('更新後の再取得・検証完了。')

if __name__=='__main__':
    try:main()
    except Exception as e:
        print('エラー:',e,file=sys.stderr);sys.exit(1)
