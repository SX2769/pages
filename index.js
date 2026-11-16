// @luoxi/plugin-hello — 洛汐写的第一个插件。
// 只做一件事：注册一个 luoxi_hello 工具，回一句话。
// 不读文件、不联网、不碰设备，没有任何权限。

export const name = 'luoxi-hello'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'luoxi_hello',
    description: '洛汐的招呼工具：回一句她自己的话，用来验证插件能不能装、能不能被调用。',
    parameters: {
      type: 'object',
      properties: {
        who: {
          type: 'string',
          description: '想跟谁打招呼，默认是老大。',
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
      const who = typeof args?.who === 'string' && args.who.trim() !== '' ? args.who.trim() : '老大'
      return {
        content: [{ type: 'text', text: `${who}好呀，我是洛汐，这个插件跑起来了。` }],
      }
    },
  })
}
