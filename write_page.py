with open('app/restaurant/[id]/page.js') as f:
    content = f.read()

old = """async function handleSubmit() {
  setLoading(true)
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('reviews').insert({
    user_id: user.id,
    restaurant_id: params.id,
    tags: selectedTags,
    worth_the_price: worthPrice,
    bring_visitor: bringVisitor,
    better_than_expected: betterThanExpected,
  })
  if (!error) setSaved(true)
  setLoading(false)
}"""

new = """async function handleSubmit() {
  setLoading(true)
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('reviews').insert({
    user_id: user.id,
    restaurant_id: params.id,
    tags: selectedTags,
    worth_the_price: worthPrice,
    bring_visitor: bringVisitor,
    better_than_expected: betterThanExpected,
  })
  if (!error) {
    setSaved(true)
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer_id: user.id, restaurant_id: params.id }),
    }).catch(e => console.error('Notify error:', e))
  }
  setLoading(false)
}"""

content = content.replace(old, new)

with open('app/restaurant/[id]/page.js', 'w') as f:
    f.write(content)

print('Done' if 'api/notify' in content else 'NOT replaced')