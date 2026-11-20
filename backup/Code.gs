// 私人預覽專案。指令碼屬性中的 R2 權杖只需預覽 bucket 的 Object Read only。
const DRIVE_FOLDER = '1XHQveeOBLjZ36oPlnC1jOwQKBseTJyzK';
const PREFIXES = ['small-step/v1/', 'small-step/employees/v1/notes.json', 'small-step/reviews/v1/current.json'];

function installBackup() {
  runBackup();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'runBackup')) {
    ScriptApp.newTrigger('runBackup').timeBased().everyHours(1).create();
  }
}

function bytes(s) { return Utilities.newBlob(s).getBytes(); }
function hex(b) { return b.map(v => ('0' + (v & 255).toString(16)).slice(-2)).join(''); }
function digest(s) { return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes(s))); }
function mac(key, s) { return Utilities.computeHmacSha256Signature(bytes(s), key); }
function encodePart(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function r2(config, key, query) {
  const host = config.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com';
  const path = '/' + config.R2_BUCKET + (key ? '/' + key.split('/').map(encodePart).join('/') : '');
  const params = Object.keys(query).sort().map(k => encodePart(k) + '=' + encodePart(query[k])).join('&');
  const time = Utilities.formatDate(new Date(), 'GMT', "yyyyMMdd'T'HHmmss'Z'");
  const day = time.slice(0, 8);
  const scope = day + '/auto/s3/aws4_request';
  const empty = digest('');
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const headers = 'host:' + host + '\nx-amz-content-sha256:' + empty + '\nx-amz-date:' + time + '\n';
  const canonical = ['GET', path, params, headers, signed, empty].join('\n');
  let signing = bytes('AWS4' + config.R2_SECRET_ACCESS_KEY);
  [day, 'auto', 's3', 'aws4_request'].forEach(s => { signing = mac(signing, s); });
  const sig = hex(mac(signing, ['AWS4-HMAC-SHA256', time, scope, digest(canonical)].join('\n')));
  const auth = 'AWS4-HMAC-SHA256 Credential=' + config.R2_ACCESS_KEY_ID + '/' + scope +
    ', SignedHeaders=' + signed + ', Signature=' + sig;
  const response = UrlFetchApp.fetch('https://' + host + path + (params ? '?' + params : ''), {
    headers: {Authorization: auth, 'x-amz-content-sha256': empty, 'x-amz-date': time},
    escaping: false, followRedirects: false, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw Error('R2 讀取失敗，HTTP ' + response.getResponseCode());
  return response;
}

function inventory(config) {
  const items = [];
  for (const prefix of PREFIXES) {
    const query = {'list-type':'2', prefix:prefix};
    do {
      const xml = XmlService.parse(r2(config, '', query).getContentText()).getRootElement();
      const ns = xml.getNamespace();
      for (const row of xml.getChildren('Contents', ns)) {
        const key = row.getChildText('Key', ns);
        if (!prefix.endsWith('/') && key !== prefix) continue;
        items.push({key:key, etag:row.getChildText('ETag', ns), size:Number(row.getChildText('Size', ns))});
      }
      query['continuation-token'] = xml.getChildText('NextContinuationToken', ns);
    } while (query['continuation-token']);
  }
  return items.sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

function runBackup() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const c = PropertiesService.getScriptProperties().getProperties();
    if (!/^[a-f0-9]{32}$/.test(c.R2_ACCOUNT_ID || '') || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(c.R2_BUCKET || '') ||
        !c.R2_ACCESS_KEY_ID || !c.R2_SECRET_ACCESS_KEY) throw Error('請完成四項 R2 指令碼屬性。');
    const folder = DriveApp.getFolderById(DRIVE_FOLDER);
    const items = inventory(c);
    if (!items.length) throw Error('預覽 R2 尚無網站資料，請先在預覽站送出一張測試便利貼。');
    const state = JSON.stringify(items);
    const manifest = 'manifest-' + digest(c.R2_ACCOUNT_ID + '/' + c.R2_BUCKET + '/' + state) + '.json';
    if (folder.getFilesByName(manifest).hasNext()) return;
    const objects = [];
    for (const item of items) {
      const name = digest(JSON.stringify([item.key,item.etag])) + '-' + item.key.split('/').pop();
      const existing = folder.getFilesByName(name);
      let file;
      if (existing.hasNext()) {
        file = existing.next();
      } else {
        const result = r2(c, item.key, {});
        const headers = result.getAllHeaders();
        const etagKey = Object.keys(headers).find(k => k.toLowerCase() === 'etag');
        if (headers[etagKey] !== item.etag) throw Error('備份期間資料已更新，下一輪重試。');
        const blob = result.getBlob().setName(name);
        if (blob.getBytes().length !== item.size) throw Error('檔案長度不符。');
        file = folder.createFile(blob);
      }
      if (file.getSize() !== item.size) throw Error('Drive 檔案長度不符。');
      objects.push(Object.assign({}, item, {driveFileId:file.getId()}));
    }
    if (JSON.stringify(inventory(c)) !== state) throw Error('備份期間資料已更新，下一輪重試。');
    folder.createFile(manifest, JSON.stringify({schema:1, createdAt:new Date().toISOString(), bucket:c.R2_BUCKET, objects:objects}), MimeType.PLAIN_TEXT);
  } finally {
    lock.releaseLock();
  }
}
