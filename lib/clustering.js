export function assignCluster(ratings) {
  let lovedChains = 0
  let lovedFine = 0
  let lovedIndependent = 0
  let dislikedChains = 0

  const chainPlaces = ['Wagamama', 'Pret a Manger', 'Five Guys']
  const finePlaces = ['The Ledbury', 'Nobu']
  const independentPlaces = ['Dishoom', 'Hawksmoor', 'Ottolenghi']

  ratings.forEach(r => {
    if (chainPlaces.includes(r.name)) {
      if (r.rating === 'love') lovedChains++
      if (r.rating === 'disliked') dislikedChains++
    }
    if (finePlaces.includes(r.name)) {
      if (r.rating === 'love') lovedFine++
    }
    if (independentPlaces.includes(r.name)) {
      if (r.rating === 'love') lovedIndependent++
    }
  })

  if (lovedFine >= 1 && dislikedChains >= 1) return 'fine_dining'
  if (lovedIndependent >= 2 && dislikedChains >= 1) return 'adventurous'
  if (lovedChains >= 2) return 'comfort'
  return 'casual'
}
