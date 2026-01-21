export class KristaFieldValueResolver {

  private static computeEscapeDepth(str: string): number {
    if(!str || str == "") {
      return 0;
    }
    const regex = /(\\+)(?=")/g;
    let match: RegExpExecArray | null;
    let maxLevel = 0;
    while ((match = regex.exec(str)) !== null) {
      const backslashCount = match[1].length;
      if (backslashCount % 2 === 1) {
        const level = Math.floor(backslashCount / 2) + 1;
        maxLevel = Math.max(maxLevel, level);
      }
    }
    return Math.log2(maxLevel) + 1;
  }

  private static fillEmptyParagraphWithBreaks(value: string): string {
    return value.replace(/<p[^>]*>(\s|&nbsp;)*<\/p>/g, '<p><br></p>')
  }

  public static escapeNestedKristaField(str: string): string {
    if (!str || str == "") {
      return "";
    }
    let escapedString = str;
    let maxLevel = this.computeEscapeDepth(str); // max depth of backslashes before quotes

    for (let currentLevel = maxLevel; currentLevel >= 1; currentLevel--) {
      const pattern = new RegExp('\\'.repeat(Math.pow(2, currentLevel)) + '"', 'g');
      escapedString = escapedString.replace(pattern, '&quot;');
    }

    return this.fillEmptyParagraphWithBreaks(escapedString);
  }
}
