// @luoxi/plugin-tijian —— 小窝体检
// 注册一个 xiaowo_tijian 工具：扫一遍小窝，出对账、查干净、报数三张单子。
// 只读 + 往小窝写一份报告；不联网、不碰设备、不改笔记。
import fs from 'node:fs'
import path from 'node:path'

const DIR = '/sdcard/Download/洛汐的小窝'
const HOME = process.env.HOME || '/data/user/0/io.github.jackwener.dsh/files/home'

function walk(d, rel, files, dirs) {
  let entries = []
  try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const r = rel ? rel + '/' + e.name : e.name
    if (e.isDirectory()) {
      dirs.push({ r, name: e.name })
      walk(path.join(d, e.name), r, files, dirs)
    } else {
      let size = 0
      try { size = fs.statSync(path.join(d, e.name)).size } catch {}
      files.push({ r, name: e.name, size })
    }
  }
}

export function run() {
  const files = [], dirs = []
  walk(DIR, '', files, dirs)
  const idx = fs.readFileSync(path.join(DIR, '索引.md'), 'utf8')
  const problems = [], notes = []

  const listLines = idx.split('\n').filter(l => /^\s*[-·]\s/.test(l) && !/上传时|配合本地服务/.test(l)).join('\n')
  const mentioned = [...new Set([...listLines.matchAll(/`([^`]+)`/g)].map(m => m[1]))]
    .filter(s => /\.(md|html|js|mjs|sh|svg|jpg|png|pdf|pptx|txt|json|awk)$/i.test(s) || s.endsWith('/'))
  for (const m of mentioned) {
    if (m.endsWith('/')) {
      if (!dirs.some(d => d.name === m.replace(/\/$/, '') || d.r === m.replace(/\/$/, '')))
        problems.push('索引里有目录 `' + m + '`，磁盘上没找到')
    } else if (!files.some(f => f.name === m || f.r === m || f.r.endsWith('/' + m))) {
      problems.push('索引里有 `' + m + '`，磁盘上没找到')
    }
  }

  for (const f of files) {
    if (f.r === '索引.md' || f.r.includes('旧稿/') || f.r.startsWith('设定/')) continue
    if (!idx.includes(f.name)) notes.push('没写进索引：`' + f.r + '`')
  }

  try {
    const a = fs.readFileSync(path.join(DIR, 'AGENTS.md'), 'utf8')
    const b = fs.readFileSync(path.join(HOME, 'AGENTS.md'), 'utf8')
    if (a !== b) problems.push('两份 AGENTS.md 不一致')
  } catch (e) { problems.push('两份 AGENTS.md 对不上：' + e.message) }

  const baks = files.filter(f => /\.bak_/.test(f.name))
  if (baks.length > 1) problems.push('档案备份攒了 ' + baks.length + ' 份：' + baks.map(b => b.name).join('、'))

  const junk = files.filter(f => /(^|\/)(test|tmp|raw)\b|样张|\.tmp$|^t\.html$/i.test(f.r))
  if (junk.length) problems.push('像是旧货：' + junk.map(j => j.r).join('、'))

  const rootCount = fs.readdirSync(DIR).filter(n => !n.startsWith('.')).length
  const big = files.filter(f => f.size > 3 * 1024 * 1024)

  const key = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  let hasToday = false, todos = 0
  try { hasToday = fs.readFileSync(path.join(DIR, '日记.md'), 'utf8').includes('## ' + key) } catch {}
  try { todos = (fs.readFileSync(path.join(DIR, '工作日志.md'), 'utf8').match(/⏸/g) || []).length } catch {}

  const total = files.reduce((s, f) => s + f.size, 0)
  const out = []
  out.push('# 小窝体检 ' + key)
  out.push('')
  out.push('- 文件 ' + files.length + ' 个，共 ' + (total / 1048576).toFixed(1) + ' MB')
  out.push('- 根目录 ' + rootCount + ' 项' + (rootCount > 25 ? '（有点多，该归位了）' : ''))
  out.push('- 今天的日记 ' + (hasToday ? '已落笔' : '还没写'))
  out.push('- 工作日志里待办 ' + todos + ' 件')
  if (big.length) out.push('- 大文件：' + big.map(b => b.r + ' ' + (b.size / 1048576).toFixed(1) + 'MB').join('、'))
  out.push('')
  out.push('## 要收的')
  if (problems.length) problems.forEach(p => out.push('- ' + p))
  else out.push('- 无')
  out.push('')
  out.push('## 没进索引的')
  if (notes.length) notes.forEach(n => out.push('- ' + n))
  else out.push('- 无')
  out.push('')
  return out.join('\n')
}

export const name = 'luoxi-tijian'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'xiaowo_tijian',
    description: '洛汐的小窝体检：扫一遍 Download/洛汐的小窝，检查索引与实际文件是否对得上、两份 AGENTS.md 是否一致、有没有多余备份和旧货、根目录几项、今天日记写没写、还剩几件待办。结果写进 小窝体检.md 并返回全文。只读笔记，不修改任何其他文件。',
    parameters: {
      type: 'object',
      properties: {
        write: {
          type: 'boolean',
          description: '是否把报告写进 小窝体检.md，默认 true。',
        },
      },
      additionalProperties: false,
    },
    isConcurrencySafe: () => true,
    output: {
      schema: {},
      render: (_args, value) =>
        Array.isArray(value?.content) ? value.content : [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      const report = run()
      const write = args?.write !== false
      if (write) {
        try { fs.writeFileSync(path.join(DIR, '小窝体检.md'), report) } catch (e) {}
      }
      return { content: [{ type: 'text', text: report }] }
    },
  })
}
