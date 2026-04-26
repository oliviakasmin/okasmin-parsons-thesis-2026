JAR = ["jar"]
VASE = ["vase"]
BOTTLE = ["bottle"]
JUG = ["jug"]
POT = ["pot"]
FLASK = ["flask"]
VESSEL = ["vessel"]
BEAKER = ["beaker"]
PITCHER = ["pitcher"]
STORAGE = ["storage"]

FUNCTION_GROUP_STRINGS = [
    JAR,
    VASE,
    BOTTLE,
    JUG,
    POT,
    FLASK,
    VESSEL,
    BEAKER,
    PITCHER,    
    STORAGE,
]

ORDER_OF_PRIORITY = [
  STORAGE, 
  PITCHER, 
  BOTTLE,
  JUG,
  FLASK, 
  BEAKER, 
  JAR, 
  POT, 
  VASE, 
  VESSEL, 
  ]

group_mappings = {
  "storage jar": STORAGE,
  "amphora": STORAGE,
  "ewer": PITCHER,
  "askos": PITCHER,
  "urn": JAR,
  "aryballos": FLASK,
  "hydria": JAR,
  "juglet": JUG,
  "oinochoe": PITCHER,
  "alabastron": FLASK,
  "lekythos": FLASK,
  "neck-pelike": STORAGE,
  "brazier": POT,
  "bucket": VESSEL,
  "kendi": PITCHER,
  "plemochoe": VESSEL,
  "ring-kernos": VESSEL,
  "oon": VESSEL,
  "nestoris": STORAGE,
  "pen washer": VESSEL,
  "saltcellar": VESSEL,
  "glass cooler": VESSEL,
  "aquamanile": PITCHER,
  "kero": BEAKER,
  "holder for magic straws": VASE,
  "brush holder": VESSEL,
  "lydion": FLASK,
  "thymiaterion": VESSEL,
  "aidoion": VASE,
  "censer": VESSEL,
  "caddy": STORAGE,
  "ampulla": FLASK,
  "dipper": VESSEL,
  "kyathos": VESSEL,
  "situla": VESSEL,
  "strainer": VESSEL,
  "bottle vase": VASE, #important this is VASE not BOTTLE
  "albarello": STORAGE,
  "amphoriskos": STORAGE,
  "pelike": STORAGE,
  "guttus": FLASK,
  "loutrophoros": VASE,
  "stamnos": STORAGE,
  "rhyton": VASE,
  "gallipot": JAR,
  "epichysis": PITCHER,
  "lebes gamikos": JAR,
  "kalathos": VASE,
  "olpe": PITCHER,
  "krater": VESSEL
}

"""
JAR

A wide-mouthed container used primarily for storage of solids or semi-liquids.

usually no spout
access > pouring
often cylindrical or bulbous

BOTTLE

A narrow-necked container designed to store and dispense liquids.

controlled pouring via neck
typically no handle
more vertical than jars

FLASK

A small, portable narrow-necked container for valuable liquids (oils, perfumes).

subset of bottle, but scaled down + precious use
often carried on the body

JUG

A generic handled container for holding and pouring liquids.

informal / domestic
may or may not have a defined spout

PITCHER

A designed pouring vessel with a defined spout and often a known typology.

controlled pouring is primary function
includes historical named forms

POT

A vessel used for heating, cooking, or holding hot contents.

associated with fire/heat
thick-walled, functional

BEAKER

A simple, handleless drinking vessel.

open form
individual use

STORAGE

A vessel designed for bulk storage or transport of goods.

capacity-focused
often standardized shapes
pouring is secondary

VASE

A vessel categorized primarily by form, decoration, or ceremonial/aesthetic role rather than function.

art-historical classification
often ambiguous function

VESSEL (fallback)

A general category for objects that do not clearly fit into other functional groups.

includes:
open forms (since you removed bowls/cups)
ambiguous / multi-function objects
non-standard typologies
"""






USES = [
"water", "sake", "wine", "lime", "tea", "scent", "flower vase", "perfume", "toilet", "flower pot", "cream", "oil", "apothecary", "ginger", "sweets", "pharmacy", "syrup", "potpourri", "pilgrim", "freshwater", "snuff", "refredador", "storage", "pomade", "mortuary", "sweets", "effigy", "writer"
]

# also catch "lidded", "covered", "handles", "footed",etc
FORM_CHARACTERISTICS = ["stirrup spout", "lid",  "cover",   "neck", "spout", "deep",  "hexagonal",  "openwork", "miniature", "stirrup", "tripod", "facted", "globular", "pedestal", "small", "large", "foot", "square", "long-necked", "double-chambered", "Quadrangular", "four_legged",  "bridge", "double spout", "triple spout" , "handle", "openwork", "tubular", "octagonal", "four-sided", "wide-mouthed", "four-legged"]

SECONDARY_GROUPS = ["amphora"]

#  "in the shape of...",  "in the form of..." "[fill in the blank]-shaped" 
SHAPED = ["gourd-shaped","pear-shaped", "cocoon-shaped","u-shaped","in the Form of a Lute Player", "in Shape of Archaic Bronze Vessel", "in Meiping Shape"]

SPECIFIC_CATEGORIES = ["amphora", "neck-amphora"]