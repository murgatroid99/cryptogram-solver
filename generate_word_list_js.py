with open('word_list2.txt', 'r', encoding='utf8') as f:
  words = list(word.rstrip('\n.').upper() for word in f)
  with open('word_list.ts', 'w', encoding='utf8') as out:
    out.write('(globalThis as any).wordList = [' + ','.join('"' + word.replace('"', '\\"') + '"' for word in words) + ']\n')
