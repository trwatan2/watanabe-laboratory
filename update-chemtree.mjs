import {
  mkdir,
  copyFile,
  access,
  rename,
  writeFile,
  appendFile,
} from 'node:fs/promises'

import {
  spawn,
} from 'node:child_process'

import {
  dirname,
  join,
} from 'node:path'

import {
  fileURLToPath,
} from 'node:url'

// ============================================
// ChemTree Automatic Updater v1.0
//
// 1. 直近365日をCrossrefから取得
// 2. Nature / Scienceを化学論文へ絞る
// 3. OpenAlex情報を追加してChemTree分類
// 4. 1M / 3M / 6M / 1Y集計
//
// 途中で失敗した場合は
// 正常だったchemtree-1y.jsonを復元
// ============================================

const ROOT =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  )

const DATA_DIR =
  join(
    ROOT,
    'public',
    'data',
  )

const LOG_DIR =
  join(
    ROOT,
    'logs',
  )

const FINAL_DATA =
  join(
    DATA_DIR,
    'chemtree-1y.json',
  )

const BACKUP_DATA =
  join(
    DATA_DIR,
    'chemtree-1y.auto-backup.json',
  )

const STEPS = [
  {
    title:
      'Step 1/4 直近365日の論文取得',

    script:
      'fetch-journals-1y.mjs',
  },

  {
    title:
      'Step 2/4 化学論文フィルター',

    script:
      'filter-chemistry-1y.mjs',
  },

  {
    title:
      'Step 3/4 ChemTree分類・トレンド解析',

    script:
      'build-chemtree-1y.mjs',
  },

  {
    title:
      'Step 4/4 期間×雑誌集計',

    script:
      'patch-1y-aggregates.mjs',
  },
]

// ============================================
// 日時
// ============================================

function nowText() {
  return new Date()
    .toLocaleString(
      'ja-JP',
      {
        timeZone:
          'Asia/Tokyo',
      },
    )
}

function fileTime() {
  return new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      '-',
    )
}

// ============================================
// ログ
// ============================================

let logFile = ''

async function log(
  message = '',
) {
  const line =
    `[${nowText()}] ${message}`

  console.log(line)

  if (logFile) {
    await appendFile(
      logFile,
      line + '\n',
      'utf8',
    )
  }
}

async function logRaw(
  text,
) {
  process.stdout.write(
    text,
  )

  if (logFile) {
    await appendFile(
      logFile,
      text,
      'utf8',
    )
  }
}

// ============================================
// ファイル存在確認
// ============================================

async function exists(
  path,
) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

// ============================================
// Nodeスクリプトを1本実行
// ============================================

function runScript(
  script,
) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const scriptPath =
        join(
          ROOT,
          script,
        )

      const child =
        spawn(
          process.execPath,
          [
            scriptPath,
          ],
          {
            cwd: ROOT,

            env:
              process.env,

            windowsHide:
              true,
          },
        )

      child.stdout.on(
        'data',
        (data) => {
          const text =
            data.toString()

          process.stdout.write(
            text,
          )

          if (logFile) {
            appendFile(
              logFile,
              text,
              'utf8',
            ).catch(
              () => {},
            )
          }
        },
      )

      child.stderr.on(
        'data',
        (data) => {
          const text =
            data.toString()

          process.stderr.write(
            text,
          )

          if (logFile) {
            appendFile(
              logFile,
              text,
              'utf8',
            ).catch(
              () => {},
            )
          }
        },
      )

      child.on(
        'error',
        reject,
      )

      child.on(
        'close',
        (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(
              new Error(
                `${script} が終了コード ${code} で停止しました。`,
              ),
            )
          }
        },
      )
    },
  )
}

// ============================================
// 正常版をバックアップ
// ============================================

async function backupCurrentData() {
  if (
    await exists(
      FINAL_DATA,
    )
  ) {
    await copyFile(
      FINAL_DATA,
      BACKUP_DATA,
    )

    await log(
      '現在の正常データをバックアップしました。',
    )
  } else {
    await log(
      '既存のchemtree-1y.jsonはありません。',
    )
  }
}

// ============================================
// 失敗時に元へ戻す
// ============================================

async function restoreBackup() {
  if (
    await exists(
      BACKUP_DATA,
    )
  ) {
    await copyFile(
      BACKUP_DATA,
      FINAL_DATA,
    )

    await log(
      'バックアップから正常データを復元しました。',
    )
  }
}

// ============================================
// 更新完了情報
// ============================================

async function writeStatus(
  status,
  message,
) {
  const path =
    join(
      DATA_DIR,
      'update-status.json',
    )

  await writeFile(
    path,
    JSON.stringify(
      {
        status,

        updatedAt:
          new Date()
            .toISOString(),

        message,
      },
      null,
      2,
    ),
    'utf8',
  )
}

// ============================================
// メイン
// ============================================

async function main() {
  await mkdir(
    DATA_DIR,
    {
      recursive: true,
    },
  )

  await mkdir(
    LOG_DIR,
    {
      recursive: true,
    },
  )

  logFile =
    join(
      LOG_DIR,
      `update-${fileTime()}.log`,
    )

  await writeFile(
    logFile,
    '',
    'utf8',
  )

  await log(
    '=====================================',
  )

  await log(
    ' ChemTree Automatic Update START',
  )

  await log(
    '=====================================',
  )

  await log(
    `作業フォルダ: ${ROOT}`,
  )

  await backupCurrentData()

  const startTime =
    Date.now()

  try {
    for (
      const step of
        STEPS
    ) {
      await log('')
      await log(
        '-------------------------------------',
      )

      await log(
        step.title,
      )

      await log(
        `実行: ${step.script}`,
      )

      await log(
        '-------------------------------------',
      )

      await runScript(
        step.script,
      )

      await log(
        `${step.title} 完了`,
      )
    }

    const seconds =
      Math.round(
        (
          Date.now() -
          startTime
        ) /
        1000,
      )

    await log('')
    await log(
      '=====================================',
    )

    await log(
      ' ChemTree Automatic Update SUCCESS',
    )

    await log(
      '=====================================',
    )

    await log(
      `処理時間: ${seconds} 秒`,
    )

    await log(
      '直近365日のChemTreeが更新されました。',
    )

    await writeStatus(
      'success',
      'ChemTree automatic update completed.',
    )
  } catch (error) {
    await log('')
    await log(
      '=====================================',
    )

    await log(
      ' ChemTree Automatic Update FAILED',
    )

    await log(
      '=====================================',
    )

    await log(
      String(
        error?.message ??
        error,
      ),
    )

    await restoreBackup()

    await writeStatus(
      'failed',
      String(
        error?.message ??
        error,
      ),
    )

    await log(
      '更新前のChemTreeを保持しました。',
    )

    process.exitCode = 1
  }

  await log('')
  await log(
    `ログ: ${logFile}`,
  )
}

main().catch(
  async (error) => {
    console.error(
      error,
    )

    try {
      await restoreBackup()
    } catch {}

    process.exit(1)
  },
)