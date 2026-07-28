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

# 第 21~100 题：真实力扣题名（在线时由 Agent 各自生成真实题面/讲解/分步）
FALLBACK_TITLES += [
    ("best-time-to-buy-and-sell-stock", "买卖股票的最佳时机", "简单"),
    ("valid-palindrome", "验证回文串", "简单"),
    ("single-number", "只出现一次的数字", "简单"),
    ("linked-list-cycle", "环形链表", "简单"),
    ("reverse-linked-list", "反转链表", "简单"),
    ("binary-tree-level-order-traversal", "二叉树的层序遍历", "中等"),
    ("convert-sorted-array-to-binary-search-tree", "将有序数组转换为二叉搜索树", "简单"),
    ("balanced-binary-tree", "平衡二叉树", "简单"),
    ("binary-tree-right-side-view", "二叉树的右视图", "中等"),
    ("lowest-common-ancestor-of-a-binary-tree", "二叉树的最近公共祖先", "中等"),
    ("invert-binary-tree", "翻转二叉树", "简单"),
    ("path-sum", "路径总和", "简单"),
    ("course-schedule", "课程表", "中等"),
    ("min-stack", "最小栈", "中等"),
    ("intersection-of-two-linked-lists", "相交链表", "简单"),
    ("two-sum-ii-input-array-is-sorted", "两数之和 II - 输入有序数组", "中等"),
    ("3sum", "三数之和", "中等"),
    ("3sum-closest", "最接近的三数之和", "中等"),
    ("letter-combinations-of-a-phone-number", "电话号码的字母组合", "中等"),
    ("4sum", "四数之和", "中等"),
    ("remove-nth-node-from-end-of-list", "删除链表的倒数第 N 个结点", "中等"),
    ("generate-parentheses", "括号生成", "中等"),
    ("combination-sum", "组合总和", "中等"),
    ("permutations", "全排列", "中等"),
    ("subsets", "子集", "中等"),
    ("word-search", "单词搜索", "中等"),
    ("number-of-islands", "岛屿数量", "中等"),
    ("rotate-image", "旋转图像", "中等"),
    ("group-anagrams", "字母异位词分组", "中等"),
    ("set-matrix-zeroes", "矩阵置零", "中等"),
    ("jump-game", "跳跃游戏", "中等"),
    ("unique-paths", "不同路径", "中等"),
    ("minimum-path-sum", "最小路径和", "中等"),
    ("edit-distance", "编辑距离", "困难"),
    ("longest-increasing-subsequence", "最长递增子序列", "中等"),
    ("house-robber", "打家劫舍", "中等"),
    ("house-robber-ii", "打家劫舍 II", "中等"),
    ("integer-break", "整数拆分", "中等"),
    ("coin-change", "零钱兑换", "中等"),
    ("perfect-squares", "完全平方数", "中等"),
    ("longest-palindromic-subsequence", "最长回文子序列", "中等"),
    ("longest-common-subsequence", "最长公共子序列", "中等"),
    ("palindromic-substrings", "回文子串", "中等"),
    ("best-time-to-buy-and-sell-stock-with-cooldown", "最佳买卖股票时机含冷冻期", "中等"),
    ("best-time-to-buy-and-sell-stock-with-transaction-fee", "最佳买卖股票时机含手续费", "中等"),
    ("best-time-to-buy-and-sell-stock-iii", "买卖股票的最佳时机 III", "困难"),
    ("task-scheduler", "任务调度器", "中等"),
    ("top-k-frequent-elements", "前 K 个高频元素", "中等"),
    ("sort-characters-by-frequency", "根据字符出现频率排序", "中等"),
    ("candy", "分发糖果", "困难"),
    ("daily-temperatures", "每日温度", "中等"),
    ("trapping-rain-water", "接雨水", "困难"),
    ("largest-rectangle-in-histogram", "柱状图中最大的矩形", "困难"),
    ("sliding-window-maximum", "滑动窗口最大值", "困难"),
    ("longest-consecutive-sequence", "最长连续序列", "中等"),
    ("find-the-duplicate-number", "寻找重复数", "中等"),
    ("sort-colors", "颜色分类", "中等"),
    ("spiral-matrix", "螺旋矩阵", "中等"),
    ("spiral-matrix-ii", "螺旋矩阵 II", "中等"),
    ("add-two-numbers-ii", "两数相加 II", "中等"),
    ("happy-number", "快乐数", "简单"),
    ("isomorphic-strings", "同构字符串", "简单"),
    ("word-pattern", "单词规律", "简单"),
    ("valid-anagram", "有效的字母异位词", "简单"),
    ("binary-search", "二分查找", "简单"),
    ("search-a-2d-matrix", "搜索二维矩阵", "中等"),
    ("first-bad-version", "第一个错误的版本", "简单"),
    ("search-in-rotated-sorted-array", "搜索旋转排序数组", "中等"),
    ("find-minimum-in-rotated-sorted-array", "寻找旋转排序数组中的最小值", "中等"),
    ("find-first-and-last-position-of-element-in-sorted-array", "在排序数组中查找元素的第一个和最后一个位置", "中等"),
    ("find-peak-element", "寻找峰值", "中等"),
    ("implement-trie-prefix-tree", "实现 Trie", "中等"),
    ("lru-cache", "LRU 缓存", "中等"),
    ("minimum-window-substring", "最小覆盖子串", "困难"),
    ("decode-string", "字符串解码", "中等"),
    ("basic-calculator", "基本计算器", "中等"),
    ("evaluate-reverse-polish-notation", "逆波兰表达式求值", "中等"),
    ("construct-binary-tree-from-preorder-and-inorder-traversal", "从前序与中序遍历序列构造二叉树", "中等"),
    ("binary-tree-level-order-traversal-ii", "二叉树的层序遍历 II", "简单"),
    ("merge-k-sorted-lists", "合并 K 个升序链表", "困难"),
]


def fallback_content(seq: int) -> dict:
    """第 1 题用真实内容；第 2~100 题一律套壳第一题《两数之和》的题面/示例/约束，
    只换题名和难度——保证离线时 100 道都有真实可用的题目内容。"""
    slug, title, difficulty = FALLBACK_TITLES[(seq - 1) % len(FALLBACK_TITLES)]
    first_content = FALLBACK_DETAIL["two-sum"]["content"]
    # 第 1 题：保持原行为（向后兼容）；其它题：保留各自题名/难度，内容套第一题
    if seq == 1:
        return {"slug": slug, "title": title, "difficulty": difficulty, **first_content}
    return {"slug": slug, "title": title, "difficulty": difficulty, **first_content}


def fallback_explanation(slug: str) -> dict:
    """讲解部分也套壳第一题：所有题共用同一份讲解+例子+金句。"""
    return FALLBACK_DETAIL["two-sum"]["explanation"]


def fallback_steps(slug: str) -> list:
    """分步代码也套壳第一题：所有题共用同一份 3 步拆分。"""
    return FALLBACK_DETAIL["two-sum"]["steps"]


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
