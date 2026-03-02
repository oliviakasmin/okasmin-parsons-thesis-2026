object_ids.json is a json list of all raw object IDs from the MET api call

reject_object_ids.json is a list of all objects that should not be included for various purposes (ie just a fragment, or multiple vessels in one image, etc.)

objects.json is a json list of an object with its relevant properties:

- objectID
- accessionYear
- isPublicDomain - reject if not true
- primaryImage
- primaryImageSmall - reject if not true
- additionalImages
- constituents
- department
- objectName
- title - reject if includes plural version of search q, ie "vases", "vessels", "pots", "jugs"
- culture
- dynasty
- reign
- portfolio
- artistRole
- artistPrefix
- artistDisplayName
- artistDisplayBio
- objectDate
- objectBeginDate
- objectEndDate
- medium
- dimensions
- dimensionsParsed
- measurements
- geographyType
- city
- state
- county
- country
- region
- subregion
- locale
- locus
- excavation
- classification - reject if doesn't include "Ceramics"
- linkResource
- tags
