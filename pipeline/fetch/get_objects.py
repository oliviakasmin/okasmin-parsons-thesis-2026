# loop through object_ids and save relevant info for each object
url = f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}"

# function to verify if want to include object based on certain properties. if keep, then save to objecst.json, otherwise save object id to reject-object-ids.json and don't save additional info to objects.json for that object