import string
import re
import sys

words = []
with open('word_list2.txt', 'r') as f:
  words = list(word.rstrip('\n.').upper() for word in f)

word_set = set(words)

cryptogram = ''
with open(sys.argv[1], 'r') as f:
  cryptogram = f.read().replace('\n', ' ')

print('Cryptogram:')
print(cryptogram)

crypto_list = list(word.rstrip(',.!?:;"\')').lstrip('"(') for whole_word in cryptogram.split(" ") for word in whole_word.split('-') if word)
#print(crypto_list)

def word_is_solved(crypto_word, partial_map):
  try:
    return all(letter in partial_map for letter in crypto_word if letter in string.ascii_uppercase)
  except TypeError:
    print(crypto_word, partial_map)
    raise

def maps_are_consistent(map1, map2):
  for k1, v1 in map1.items():
    for k2, v2 in map2.items():
      if k1 == k2 and v1 != v2:
        return False
      if v1 == v2 and k1 != k2:
        return False
  return True

def validate_map(partial_map):
  return len(set(partial_map.values())) == len(partial_map) and not any(k == partial_map[k] for k in partial_map)

def apply_map(text, full_map):
  return ''.join(full_map.get(letter, letter) for letter in text)

def apply_partial_map(text, partial_map):
  return ''.join(partial_map.get(letter, '_' if letter in string.ascii_uppercase else letter) for letter in text)

def get_missing_letter_regex(letter, partial_map):
  return '[' + ''.join(set(string.ascii_uppercase) - set(partial_map.values()) - set([letter])) + ']'

def get_word_regex(word, partial_map):
  letter_group = {}
  next_group = 1
  regex = '^'
  for letter in word:
    if letter in string.ascii_uppercase:
      if letter in letter_group:
        regex += letter_group[letter]
      elif letter in partial_map:
        regex += partial_map[letter]
      else:
        letter_group[letter] = '\\' + str(next_group)
        next_group += 1
        regex += '(' + get_missing_letter_regex(letter, partial_map) + ')'
    else:
      regex += letter
  regex += '$'
  return re.compile(regex)

def solved_ratio(crypto_word, partial_map):
  return sum(1 for letter in crypto_word if letter in partial_map) / sum(1 for letter in crypto_word if letter in string.ascii_uppercase)

def count_empties(crypto_word, partial_map):
  return sum(1 for letter in crypto_word if letter not in partial_map)

def count_filled(crypto_word, partial_map):
  return sum(1 for letter in crypto_word if letter in partial_map)

def count_matching(crypto_word, partial_map):
  regex = get_word_regex(crypto_word, partial_map)
  return sum(1 for word in words if regex.match(word) is not None)

def validate_word(crypto_word, partial_map):
  if word_is_solved(crypto_word, partial_map):
    return apply_map(crypto_word, partial_map) in word_set
  else:
    word_re = get_word_regex(crypto_word, partial_map)
    return any(word_re.match(word) is not None for word in words if len(word) == len(crypto_word))

def try_solve_word(crypto_list, partial_map, tried, crypto_word, word):
  if len(word) == len(crypto_word) and not word_is_solved(crypto_word, partial_map) and get_word_regex(crypto_word, partial_map).match(word) is not None:
    word_map = dict((crypto_letter, letter) for crypto_letter, letter in zip(crypto_word, word) if crypto_letter in string.ascii_uppercase)
    #print(crypto_word, word, validate_map(word_map), word_is_solved(crypto_word, word_map), maps_are_consistent(word_map, partial_map))
    if validate_map(word_map) and word_is_solved(crypto_word, word_map) and maps_are_consistent(word_map, partial_map):
      word_map.update(partial_map)
      if any(word_map == attempt for attempt in tried):
        return
      #print([validate_word(crypto_word, word_map) for crypto_word in crypto_list])
      if all(validate_word(crypto_word, word_map) for crypto_word in crypto_list):
        print(apply_partial_map(cryptogram, word_map))
        if all(word_is_solved(crypto_word, word_map) for crypto_word in crypto_list):
          yield word_map
        else:
          for solution in solve_cryptogram(crypto_list, word_map, tried):
            yield solution
      tried.append(word_map)

def split_contractions(crypto_list):
  for (index, word) in enumerate(crypto_list):
    if "'" in word:
      apostrophe_index = word.index("'")
      print(word, apostrophe_index)
      if apostrophe_index > 0:
        yield crypto_list[:index] + [word[:apostrophe_index], word[apostrophe_index:]] + crypto_list[index + 1:]

def solve_cryptogram(crypto_list, partial_map, tried):
  if all(word_is_solved(crypto_word, partial_map) for crypto_word in crypto_list):
    yield partial_map
    return
  if any(count_matching(word, partial_map) == 0 for word in crypto_list):
    for split_crypto_list in split_contractions(crypto_list):
      print(split_crypto_list)
      yield from solve_cryptogram(split_crypto_list, partial_map, tried)
  crypto_word = min((word for word in crypto_list if not word_is_solved(word, partial_map)), key=lambda word: count_matching(word, partial_map))
  #regex = get_word_regex(crypto_word, partial_map)
  #print(crypto_word, [word for word in words if regex.match(word) is not None])
  found_any_solutions = False
  for word in words:
    for solution in try_solve_word(crypto_list, partial_map, tried, crypto_word, word):
      yield solution
      found_any_solutions = True
  if not found_any_solutions:
    # Handle "'s" separately from the word
    for split_crypto_list in split_contractions(crypto_list):
      yield from solve_cryptogram(split_crypto_list, partial_map, tried)

if __name__ == "__main__":
  print('Solutions:')
  for result in solve_cryptogram(crypto_list, {}, []):
    print(apply_map(cryptogram, result))