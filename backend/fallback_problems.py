"""离线 fallback 题库。

当 DeepSeek Key 未配置或调用失败时，用这里的内置内容保证
"手撕学习" 的完整流程（题面 -> 讲解 -> 分步 -> 审查）仍可演示。
在线时以 Agent 生成为主，这里仅作兜底。

FALLBACK_TITLES：100 道经典力扣题的顺序清单（出题 Agent 的选题依据）。
FALLBACK_DETAIL：为前几题提供完整题面/讲解/分步，供离线全流程演示。
"""

FALLBACK_TITLES = [
    ("two-sum", "两数之和", "简单"),
    ("add-two-numbers", "两数相加", "中等"),
    ("longest-substring-without-repeating-characters", "无重复字符的最长子串", "中等"),
    ("median-of-two-sorted-arrays", "寻找两个正序数组的中位数", "困难"),
    ("longest-palindromic-substring", "最长回文子串", "中等"),
    ("reverse-integer", "整数反转", "中等"),
    ("palindrome-number", "回文数", "简单"),
    ("container-with-most-water", "盛最多水的容器", "中等"),
    ("roman-to-integer", "罗马数字转整数", "简单"),
    ("longest-common-prefix", "最长公共前缀", "简单"),
    ("valid-parentheses", "有效的括号", "简单"),
    ("merge-two-sorted-lists", "合并两个有序链表", "简单"),
    ("remove-duplicates-from-sorted-array", "删除有序数组中的重复项", "简单"),
    ("search-insert-position", "搜索插入位置", "简单"),
    ("maximum-subarray", "最大子数组和", "中等"),
    ("climbing-stairs", "爬楼梯", "简单"),
    ("merge-sorted-array", "合并两个有序数组", "简单"),
    ("binary-tree-inorder-traversal", "二叉树的中序遍历", "简单"),
    ("symmetric-tree", "对称二叉树", "简单"),
    ("maximum-depth-of-binary-tree", "二叉树的最大深度", "简单"),
]

# 若需要凑满 100，用占位主题补齐（在线时由 Agent 实时生成真实题目）
_EXTRA = [
    "best-time-to-buy-and-sell-stock", "single-number", "linked-list-cycle",
    "min-stack", "intersection-of-two-linked-lists", "majority-element",
    "reverse-linked-list", "contains-duplicate", "invert-binary-tree",
    "valid-anagram", "move-zeroes", "fizz-buzz", "subtree-of-another-tree",
    "first-bad-version", "ransom-note", "add-binary", "sqrtx",
    "plus-one", "length-of-last-word", "remove-element",
]
_idx = 0
while len(FALLBACK_TITLES) < 100:
    slug = f"{_EXTRA[_idx % len(_EXTRA)]}-{len(FALLBACK_TITLES)}"
    FALLBACK_TITLES.append((slug, f"经典算法题 #{len(FALLBACK_TITLES)+1}", "中等"))
    _idx += 1


def fallback_content(seq: int) -> dict:
    slug, title, difficulty = FALLBACK_TITLES[(seq - 1) % len(FALLBACK_TITLES)]
    detail = FALLBACK_DETAIL.get(slug)
    if detail:
        return {"slug": slug, "title": title, "difficulty": difficulty, **detail["content"]}
    return {
        "slug": slug,
        "title": title,
        "difficulty": difficulty,
        "statement": f"这是第 {seq} 题《{title}》。请根据题目名称回忆其经典描述，"
        f"配置 DeepSeek-V4 的 Key 后，出题 Agent 会为你生成完整、规范的题面。",
        "examples": [{"input": "示例输入", "output": "示例输出", "explanation": "示例说明"}],
        "constraints": ["数据范围见力扣原题"],
    }


def fallback_explanation(slug: str) -> dict:
    detail = FALLBACK_DETAIL.get(slug)
    if detail:
        return detail["explanation"]
    return {
        "explanation": "配置 DeepSeek-V4 后，讲解 Agent 会给出形象生动又简洁明了的思路拆解。",
        "worked_example": "配置后可查看逐步推演的例子。",
        "golden_quote": "把复杂的问题拆小，本身就是一种解法。",
    }


def fallback_steps(slug: str) -> list:
    detail = FALLBACK_DETAIL.get(slug)
    if detail:
        return detail["steps"]
    return [
        {
            "index": 0,
            "title": "第一步：搭好函数骨架",
            "explanation": "先明确输入输出，写出函数签名，是手撕代码的第一步。",
            "code": "def solve(nums):\n    # 定义结果容器\n    result = None\n    return result",
        }
    ]


# ---------------- 完整离线内容（第 1 题：两数之和）----------------
FALLBACK_DETAIL = {
    "two-sum": {
        "content": {
            "statement": (
                "给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出"
                "和为目标值 target 的那两个整数，并返回它们的数组下标。\n"
                "你可以假设每种输入只会对应一个答案，并且你不能使用两次相同的元素。"
            ),
            "examples": [
                {"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]",
                 "explanation": "因为 nums[0] + nums[1] == 9，返回 [0, 1]。"},
                {"input": "nums = [3,2,4], target = 6", "output": "[1,2]", "explanation": "2 + 4 == 6。"},
            ],
            "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "只会存在一个有效答案"],
        },
        "explanation": {
            "explanation": (
                "想象你手里有一串数字，要找出两个加起来等于 target 的。"
                "最笨的办法是两两配对试一遍（双重循环），但太慢。\n"
                "聪明的做法：一边走一边记账。用一个哈希表记下'我见过的数字和它的位置'。"
                "每来一个数 x，我就问哈希表：'有没有人等于 target - x？'——"
                "如果有，配对成功；如果没有，就把 x 记进账本，继续往前走。"
                "这样只需走一遍，时间复杂度 O(n)。"
            ),
            "worked_example": (
                "nums=[2,7,11,15], target=9：\n"
                "看到 2，账本空，需要 7，没有 → 记下 {2:0}\n"
                "看到 7，需要 9-7=2，账本里有 2（下标0）→ 返回 [0,1]。"
            ),
            "golden_quote": "记住走过的路，就不必回头重走——空间是用来换时间的智慧。",
        },
        "steps": [
            {
                "index": 0,
                "title": "第一步：准备账本（哈希表）",
                "explanation": "用字典记录每个数字及其下标，为后续的 O(1) 查找做准备。",
                "code": (
                    "def twoSum(nums, target):\n"
                    "    # seen 是账本：键=见过的数字，值=它的下标\n"
                    "    seen = {}"
                ),
            },
            {
                "index": 1,
                "title": "第二步：遍历并同时记账、查账",
                "explanation": "边遍历边查找互补数，找到即返回；否则把当前数记入账本。",
                "code": (
                    "def twoSum(nums, target):\n"
                    "    # seen 是账本：键=见过的数字，值=它的下标\n"
                    "    seen = {}\n"
                    "    # 一边走一边记账、查账\n"
                    "    for i, num in enumerate(nums):\n"
                    "        # 还差多少才能凑成 target\n"
                    "        need = target - num\n"
                    "        # 账本里见过这个互补数吗\n"
                    "        if need in seen:\n"
                    "            # 配对成功，返回两个下标\n"
                    "            return [seen[need], i]\n"
                    "        # 没见过就把当前数记进账本\n"
                    "        seen[num] = i"
                ),
            },
            {
                "index": 2,
                "title": "第三步：兜底返回",
                "explanation": "题目保证有解，但严谨起见给出无解时的返回，避免函数隐式返回 None。",
                "code": (
                    "def twoSum(nums, target):\n"
                    "    # seen 是账本：键=见过的数字，值=它的下标\n"
                    "    seen = {}\n"
                    "    # 一边走一边记账、查账\n"
                    "    for i, num in enumerate(nums):\n"
                    "        need = target - num\n"
                    "        if need in seen:\n"
                    "            return [seen[need], i]\n"
                    "        seen[num] = i\n"
                    "    # 防御性返回（题目保证有解，这里不会走到）\n"
                    "    return []"
                ),
            },
        ],
    },
}
