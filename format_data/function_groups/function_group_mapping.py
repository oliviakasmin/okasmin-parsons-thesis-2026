JAR = ["jar"]
VASE = ["vase"]
BOTTLE = ["bottle"]
JUG = ["jug"]
POT = ["pot"]
FLASK = ["flask"]
VESSEL = ["vessel"]
BEAKER = ["beaker"]
PITCHER = ["pitcher"]
AMPHORA = ["amphora"]

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
    AMPHORA,
]

ORDER_OF_PRIORITY = [
    AMPHORA,
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
    "amphora": AMPHORA,
    "neck-amphora": AMPHORA,
    "amphoriskos": AMPHORA,

    "ewer": PITCHER,
    "askos": PITCHER,
    "oinochoe": PITCHER,
    "kendi": PITCHER,
    "aquamanile": PITCHER,
    "epichysis": PITCHER,
    "olpe": PITCHER,

    "juglet": JUG,

    "aryballos": FLASK,
    "alabastron": FLASK,
    "lekythos": FLASK,
    "lydion": FLASK,
    "ampulla": FLASK,
    "guttus": FLASK,

    "urn": JAR,
    "hydria": JAR,
    "neck-pelike": JAR,
    "nestoris": JAR,
    "pelike": JAR,
    "stamnos": JAR,
    "albarello": JAR,
    "gallipot": JAR,



    "brazier": POT,

    "kero": BEAKER,

    "bottle vase": VASE,  # important: VASE, not BOTTLE
    "loutrophoros": VASE,
    "rhyton": VASE,
    "kalathos": VASE,
    "holder for magic straws": VASE,
    "aidoion": VASE,

    "bucket": VESSEL,
    "plemochoe": VESSEL,
    "ring-kernos": VESSEL,
    "oon": VESSEL,
    "pen washer": VESSEL,
    "saltcellar": VESSEL,
    "glass cooler": VESSEL,
    "brush holder": VESSEL,
    "thymiaterion": VESSEL,
    "censer": VESSEL,
    "dipper": VESSEL,
    "kyathos": VESSEL,
    "situla": VESSEL,
    "strainer": VESSEL,
    "krater": VESSEL,
    "calyx-krater": VESSEL,
    "lebes gamikos": VESSEL,
    "caddy": VESSEL,
}





"""
AR

A container labeled “jar” in the data, typically described as storage-related and often appearing with modifiers like “covered,” “storage,” or specific contents (e.g., tea, pharmacy).

VASE

An object labeled “vase” in the data, often associated with decorative or display contexts, including phrases like “vase with [motif]” or “flower vase.”

BOTTLE

A container labeled “bottle” in the data, frequently paired with liquid descriptors such as “wine,” “water,” or “scent.”

JUG

A handled container labeled “jug” in the data, sometimes modified by contents (e.g., “cream jug”) but primarily identified by the noun itself.

POT

An object labeled “pot” in the data, used across multiple contexts (e.g., “flower pot,” “bean pot,” “milk pot”), without a single consistent function implied by the term alone.

FLASK

A container labeled “flask” in the data or a closely related named type (e.g., alabastron, lekythos), often associated with specific liquids like oil or perfume.

VESSEL

A generic label used in the data when no more specific noun is applied, or for objects whose type is unclear, uncommon, or not captured by other categories.

BEAKER

A drinking container labeled “beaker” in the data, typically appearing without handles and sometimes modified by descriptors like “black-topped.”

PITCHER

A pouring container labeled “pitcher” in the data (and including synonymous terms like “ewer”), often appearing with liquid descriptors such as “water” or “wine.”

AMPHORA

A container labeled “amphora” in the data, including variations such as “neck-amphora” or named subtypes, treated as a distinct category based on consistent usage of the term.
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






# pouring
# water
# wine
# funerary
# storage
# rituation / ceremonial
# drinking
# precious liquids (perfurmes and oiles)