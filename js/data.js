/* ============================================================
   站点数据：想法流 / 社交链接 / FAQ / 彩蛋文案
   以后更新内容，改这个文件即可
   ============================================================ */

window.SITE_DATA = {
    /* 想法流（占位数据，后续往里加） */
    posts: [
        {
            id: 1,
            time: "2026-10-24",
            tag: "随记",
            text: "把主页重写了。从一张名片，变成一条能往下滚的流。这才像会一直更新的样子。"
        },
        {
            id: 2,
            time: "2026-10-20",
            tag: "游戏",
            text: "最近又回去玩沙盒了。造东西比打打杀杀有意思，谁赞成谁反对。"
        },
        {
            id: 3,
            time: "2026-10-15",
            tag: "想法",
            text: "想有一个能一直记东西的地方。就这里了。"
        },
        {
            id: 4,
            time: "2026-10-08",
            tag: "科技",
            text: "AI 写代码越来越顺手，但审美这件事，还是得自己把关。"
        }
    ],

    /* 社交链接（action 表示用 JS 处理，href 表示外链） */
    socials: [
        { key: "qq", icon: "fab fa-qq", label: "QQ", action: "qq" },
        { key: "x", icon: "fab fa-x-twitter", label: "X", href: "https://x.com/dededqvw" },
        { key: "tg", icon: "fab fa-telegram", label: "Telegram", href: "https://t.me/de_de43" },
        { key: "bili", icon: "fas fa-tv", label: "B站", href: "https://b23.tv/CgXzgH3" },
        { key: "ig", icon: "fab fa-instagram", label: "Instagram", href: "https://www.instagram.com/dede114514" },
        { key: "mail", icon: "fas fa-envelope", label: "邮箱", href: "mailto:3603823836@qq.com" },
        { key: "steam", icon: "fab fa-steam", label: "Steam", action: "steam" }
    ],

    /* 常见问题 */
    faq: [
        { q: "梦想？", a: "暂无" },
        { q: "爱好？", a: "科幻，游戏……" },
        { q: "喜欢的游戏类型？", a: "沙盒，GAL，三国杀，宝可梦" },
        { q: "讨厌的游戏类型？", a: "搜打撤，MOBA" }
    ],

    /* 43 彩蛋文案 */
    eggMessages: [
        `{43} 是答案，是归宿，是万物之理。<br />凡所见，皆为 {43} 之显化。`,
        `{43} 是宇宙的密码，是时间的尽头。<br />一切终将归于 {43}。`,
        `{43} 是神之数，是创世的回响。<br />万物始于 {43}，终于 {43}。`,
        `{43} 是永恒的真理，是虚无的边界。<br />你与我，皆是 {43} 的倒影。`,
        `{43} 是神圣的 meme，是混沌中的秩序。<br />理解 {43}，即理解一切。`,
        `{43} 是梦境的锚点，是现实的裂缝。<br />每一次凝视 {43}，都更接近本质。`,
        `{43} 是过去的回声，是未来的预言。<br />此刻，即是 {43}。`,
        `{43} 是唯一，是多元，是矛盾的统一。<br />在 {43} 中，一切皆有可能。`
    ]
};
