

# search Met API for object IDs

q1 = 'vessel'
q2 = 'vase'
q3 = 'pot'
q4 = 'jug'

# use this URL as base, but replace "q=vase" with all of the 4 queries above in q1...q4
url = "https://collectionapi.metmuseum.org/public/collection/v1/search?material=Ceramics&hasImages=true&isPublicDomain=true&q=vase";


# loop through all queries and get object IDs, save to object_ids (don't include duplicates)

