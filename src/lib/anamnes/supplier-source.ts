// Internal supplier evidence, not public product claims or instructions.
// Transcribed from the user-provided PDF, all 16 pages visually reviewed.
// Preserve list-specific spellings, preparation and unresolved contradictions.
// Do not send the full document, disease lists or supplier prose to public DTOs.
export interface SupplierSourceFact {
  text: string;
  pages: number[];
  kind: 'supplier' | 'interpretation' | 'unverified';
}
export interface SupplierFormulaSource {
  id: string;
  supplier: 'China Nature';
  document: 'rangejohan.pdf';
  documentSha256: string;
  productName: string;
  pdfProductName: string;
  formulaName: string;
  chineseName: string | null;
  pages: number[];
  ingredients: { pinyin: string; botanicalName: string; pages: number[] }[];
  actions: SupplierSourceFact[];
  traditionalPatterns: SupplierSourceFact[];
  indications: SupplierSourceFact[];
  explanation: SupplierSourceFact[];
  temperature: SupplierSourceFact[];
  cautions: SupplierSourceFact[];
  verificationIssues: { code: string; message: string; pages: number[] }[];
  unverifiedFields: string[];
}

export const supplierFormulaSources: SupplierFormulaSource[] = [
  {
    "id": "supplier-athletic",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Athletic Herbs",
    "pdfProductName": "Athelic herbs",
    "formulaName": "Zhuang Yao Tang",
    "chineseName": null,
    "pages": [
      1,
      2
    ],
    "ingredients": [
      {
        "pinyin": "Du Zhong",
        "botanicalName": "eucommia cortex",
        "pages": [
          1
        ]
      },
      {
        "pinyin": "Du Huo",
        "botanicalName": "angelica pubescens radix",
        "pages": [
          1
        ]
      },
      {
        "pinyin": "Tu Si Zi",
        "botanicalName": "cuscuta semen",
        "pages": [
          1
        ]
      },
      {
        "pinyin": "Xu Duan",
        "botanicalName": "dipsacus radix",
        "pages": [
          1
        ]
      },
      {
        "pinyin": "xuan niu xi",
        "botanicalName": "cyathula radix",
        "pages": [
          1
        ]
      },
      {
        "pinyin": "Ba Ji Tian",
        "botanicalName": "morinda officinalis radix",
        "pages": [
          1
        ]
      }
    ],
    "actions": [
      {
        "text": "Alleviates pain",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Disperses Blood Stasis in the Lower Burner",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Disperses wind-cold-damp",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Reinforces Liver and Kidney",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Remineralizing",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Strenghtens and warms Yang",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens tendons and bones",
        "pages": [
          1
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "The formula mainly contains kidney yang strengthening herbs and is therefore not recommended for back pain caused by yin deficiency or damp-heat.",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Disperses wind-cold-damp",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Zhuang Yao Tang benefits people with chronic back problems, aggravated by fatigue, too much physical activity or too little, morning stiffness.",
        "pages": [
          1
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Discopathy, disc protusion and disc herniation",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Low back pain",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Lumbago",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Osteoporose",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "Sciatica",
        "pages": [
          1
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Zhuang Yao Tang benefits people with chronic back problems, aggravated by fatigue, too much physical activity or too little, morning stiffness. The formula mainly contains kidney yang strengthening herbs and is therefore not recommended for back pain caused by yin deficiency or damp-heat.",
        "pages": [
          1
        ],
        "kind": "supplier"
      },
      {
        "text": "The main ingredient within this formula is Cortex Eucommia (Du Zhong). It is sweet and warm in temperature to powerfully strengthen the yang of the kidney and liver and promote the circulation for weak sinews and bones. Semen Cuscuta (Tu Si Zi) and Radix Dipsacus (Xu Duan) are both sweet to tonify liver and kidney, but also acrid to break blood stasis and relieve pain. Radix Cyathula (Chuan Niu Xi) is bitter, sour and neutral, strengthens yang and moves blood, but also treats wind-damp bi. The formula also contains 2 herbs that dispel wind, damp and cold: Radix Morinda (Ba Ji Tian) and Radix Angelica Pubescens (Du Huo). Ba Ji Tian strengthens the tendons and bones. Du Huo has an acrid taste to relieve pain and also directs the action of the formula to the lower back. Temperature of the formula: warm.",
        "pages": [
          2
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Temperature of the formula: warm.",
        "pages": [
          2
        ],
        "kind": "supplier"
      }
    ],
    "cautions": [
      {
        "text": "do not use during pregnancy",
        "pages": [
          2
        ],
        "kind": "supplier"
      },
      {
        "text": "use with caution in case of yin deficiency or damp-heat",
        "pages": [
          2
        ],
        "kind": "supplier"
      },
      {
        "text": "best combined with external therapy such as hualun or TDP patch, or manual laser",
        "pages": [
          2
        ],
        "kind": "supplier"
      }
    ],
    "verificationIssues": [],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters"
    ]
  },
  {
    "id": "supplier-coptis-scute",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Coptis & Scute Herbs",
    "pdfProductName": "Coptis & scute herbs",
    "formulaName": "Huang Lian Jie Du Tang",
    "chineseName": null,
    "pages": [
      2,
      3
    ],
    "ingredients": [
      {
        "pinyin": "Huang Lian",
        "botanicalName": "coptidis sinensis rhizoma",
        "pages": [
          2
        ]
      },
      {
        "pinyin": "Zhi Zi",
        "botanicalName": "gardenia jasminoides fructus",
        "pages": [
          2
        ]
      },
      {
        "pinyin": "Huang Bai (sheng)",
        "botanicalName": "phellodendron cortex",
        "pages": [
          2
        ]
      },
      {
        "pinyin": "Huang Qin",
        "botanicalName": "scutellaria baicalensis radix",
        "pages": [
          2
        ]
      }
    ],
    "actions": [
      {
        "text": "Clears Heat",
        "pages": [
          2
        ],
        "kind": "supplier"
      },
      {
        "text": "Eliminates Damp-Heat",
        "pages": [
          2
        ],
        "kind": "supplier"
      },
      {
        "text": "Eliminates Toxins",
        "pages": [
          2
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "This formula is indicated for a wide range of indication as long as the underlying pattern is excess, heat, fire and toxins in all three warmers of the body.",
        "pages": [
          3
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Eczema",
        "pages": [
          2
        ],
        "kind": "supplier"
      },
      {
        "text": "Flu",
        "pages": [
          2
        ],
        "kind": "supplier"
      },
      {
        "text": "Furuncles and carbuncles",
        "pages": [
          2
        ],
        "kind": "supplier"
      },
      {
        "text": "Rosacea",
        "pages": [
          3
        ],
        "kind": "supplier"
      },
      {
        "text": "Shingles",
        "pages": [
          3
        ],
        "kind": "supplier"
      },
      {
        "text": "Sore throat",
        "pages": [
          3
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "This formula is indicated for a wide range of indication as long as the underlying pattern is excess, heat, fire and toxins in all three warmers of the body. This composition is made up of bitter and cold herbs that together detoxify, cool down the fire and dry up dampness in all three burners. Fructus Gardenia (Zhi Zi) quenches fire in the three warmers and drains heat and damp downward. Rhizoma Coptis (Huang Lian) has a yellow reddish colour and eliminates fire and heat in the heart and in the middle burner and dries dampness. Radix Scutellaria (Huang Qin) has a yellow greenish colour and eliminates fire in the middle warmer and in lung, liver and gallbladder. Pathogenic fire directly endangers kidney Jing so Cortex Phellodendron (Huang Bai) with a yellow blackish colour is added to drain the fire in the lower burner and consolidate the Yin. Once the pathogenic fire is eliminated the healthy fire can return to the kidney.",
        "pages": [
          3
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "This composition is made up of bitter and cold herbs that together detoxify, cool down the fire and dry up dampness in all three burners.",
        "pages": [
          3
        ],
        "kind": "supplier"
      },
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          2,
          3
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "Inget särskilt avsnitt med kontraindikationer eller försiktighetsåtgärder anges för denna produkt i dokumentet. Detta innebär inte att risker eller interaktioner saknas.",
        "pages": [
          2,
          3
        ],
        "kind": "unverified"
      }
    ],
    "verificationIssues": [],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  },
  {
    "id": "supplier-tonic",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Tonic Herbs",
    "pdfProductName": "Tonic herbs",
    "formulaName": "Shi Quan Da Bu Tang",
    "chineseName": null,
    "pages": [
      3,
      4
    ],
    "ingredients": [
      {
        "pinyin": "Huang Qi",
        "botanicalName": "astragalus radix",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Shu Di Huang",
        "botanicalName": "rehmania praeparata radix",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Bai Shao",
        "botanicalName": "paeonia lactiflora radix",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Bai Zhu",
        "botanicalName": "atractylodes macrocephala rhizoma",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Dang Gui",
        "botanicalName": "angelica sinensis radix",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Fu Ling",
        "botanicalName": "poria sclerotium",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Chuanxiong",
        "botanicalName": "ligusticum chuanxiong rhizoma",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Ren Shen",
        "botanicalName": "ginseng radix",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Da Zao",
        "botanicalName": "ziziphus jujubae fructus",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Sheng Jiang",
        "botanicalName": "zingiberis recens rhizoma",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Gan Cao Zhi",
        "botanicalName": "glycyrrhizha praeparata radix",
        "pages": [
          3
        ]
      },
      {
        "pinyin": "Rou Gui",
        "botanicalName": "cinnamomum cortex",
        "pages": [
          3
        ]
      }
    ],
    "actions": [
      {
        "text": "Nourishes Blood",
        "pages": [
          3
        ],
        "kind": "supplier"
      },
      {
        "text": "Strenghtens and warms Yang",
        "pages": [
          4
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Qi",
        "pages": [
          4
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Wei Qi (immunity)",
        "pages": [
          4
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "This is a variation of Ba Zhen Tang for qi and blood deficiency with cold.",
        "pages": [
          4
        ],
        "kind": "supplier"
      },
      {
        "text": "Pale tongue with a thin, white coating. Thready, weak pulse.",
        "pages": [
          4
        ],
        "kind": "supplier"
      },
      {
        "text": "This situation not only requires strengthening qi and blood, but also warming yang and improving immunity.",
        "pages": [
          4
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Chronic fatigue",
        "pages": [
          4
        ],
        "kind": "supplier"
      },
      {
        "text": "Infertility (male)",
        "pages": [
          4
        ],
        "kind": "supplier"
      },
      {
        "text": "Anemia",
        "pages": [
          4
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "This is a variation of Ba Zhen Tang for qi and blood deficiency with cold. Indications are chronic fatigue, postpartum weakness or insufficient lactation, post-surgery, anorexia, long or irregular menstrual cycle. Also in case of difficult recovery from painful ulcers and abscesses due to diabetes, for example. Pale tongue with a thin, white coating. Thready, weak pulse. This situation not only requires strengthening qi and blood, but also warming yang and improving immunity. Radix Astragali (Huang Qi) strengthens wei qi and Cortex Cinnamomi (Rou Gui) warms the kidneys and meridians, and stimulates the transformation of qi into blood. Rhizoma zingiberis recens (Sheng Jiang) and Fructus Jujuba (Da Zao) warm the middle, harmonize ying and wei, and aid the digestive system to absorb the other, tonifying herbs of the formula. These herbs are thus added to the basic formula Ba Zhen Tang, or Si Jun Zi + Si Wu. Si Jun Zi strengthens the qi through improving the transporting and transforming capacity of the spleen itself. Radix et rhizoma ginseng (Ren Shen) is sweet and warm, and powerfully strengthens the yuan qi, spleen and stomach. Radix Atractylodes (Bai Zhu) and Sclerotium Poria Cocos (Fu Ling) work together to strengthen the spleen and remove dampness. Radix Glycyrrhiza (Gan Cao) is sweet and warm and has a beneficial effect on the heart and spleen. This herb restores spleen qi by stimulating the fire element and also harmonizes the formula. Si Wu is a balanced blood strengthening formula. Radix Rehmannia (Shu Di Huang) nourishes blood, yin and jing, and strengthens liver and kidney. Radix Paeonia lactiflora (Bai Shao) nourishes blood and preserves yin. To counterbalance these 2 'still' herbs, 2 dynamic herbs have been added, namely Radix Angelica (Dang Gui) and Rhizoma Ligusticum (Chuan Xiong). Radix Angelica (Dang Gui) nourishes and moves blood to prevent blood stasis. Rhizoma Ligusticum (Chuan Xiong) moves the Qi at the blood level. It reaches both the brain and the uterus to supply the entire body with fresh blood.",
        "pages": [
          4
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          3,
          4
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "do not use during a cold or flu",
        "pages": [
          4
        ],
        "kind": "supplier"
      },
      {
        "text": "use with caution in patients with a weak digestion",
        "pages": [
          4
        ],
        "kind": "supplier"
      }
    ],
    "verificationIssues": [],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  },
  {
    "id": "supplier-stomach",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Stomach Herbs",
    "pdfProductName": "Stomach herbs",
    "formulaName": "Xiang Sha Liu Jun Zi Tang",
    "chineseName": null,
    "pages": [
      5,
      6
    ],
    "ingredients": [
      {
        "pinyin": "Bai Zhu",
        "botanicalName": "atractylodes macrocephala rhizoma",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Fu Ling",
        "botanicalName": "poria sclerotium",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Sheng Jiang",
        "botanicalName": "zingiberis recens rhizoma",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Ban Xia (Jiang)",
        "botanicalName": "pinellia praeparatum (Jiang) rhizoma",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Ren Shen",
        "botanicalName": "ginseng radix",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Chen pi",
        "botanicalName": "citrus reticulata pericarpium",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Bai Dou Kou",
        "botanicalName": "amomum rotundus fructus",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Gan Cao Zhi",
        "botanicalName": "glycyrrhizha praeparata radix",
        "pages": [
          5
        ]
      },
      {
        "pinyin": "Mu Xiang",
        "botanicalName": "aucklandia radix",
        "pages": [
          5
        ]
      }
    ],
    "actions": [
      {
        "text": "Alleviates pain",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Circulates Qi",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Eliminates Damp",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Harmonizes the Middle Jiao",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Qi",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Spleen and Stomach",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Warms the Middle Burner",
        "pages": [
          5
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "Xiang Sha Liu Jun Zi Tang treats damp-cold stagnation in the Middle Jiao.",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Together they improve the flow of Qi in the digestive system, thereby resolving food stagnation, distension and pain.",
        "pages": [
          6
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Chronic fatigue",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Gastritis (atrophic)",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Gastroesophageal reflux",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Irritable bowel syndrome (IBS)",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Meniere's disease",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Stomach complaints (dyspepsia)",
        "pages": [
          5
        ],
        "kind": "supplier"
      },
      {
        "text": "Ulcer of stomach or duodenum",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Abdominal distension",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Anorexia",
        "pages": [
          6
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Xiang Sha Liu Jun Zi Tang treats damp-cold stagnation in the Middle Jiao. Radix et rhizoma ginseng (Ren Shen) is sweet and warm, and powerfully strengthens Yuan Qi, Spleen and Stomach. Bitter Radix Atractylodes (Bai Zhu) and bland Poria Cocos (Fu Ling) work synergestically to dry damp and strengthen the Spleen. Radix Glycyrrhiza (Gan Cao) nourishes and warms the spleen and harmonizes the actions of the other herbs. Rhizoma Zingiberis (Sheng Jiang) and Rhizoma Pinellia processed with ginger (Ban Xia Jiang) warms the Middle Jiao, directs Qi downwards and transforms turbid phlegm. Pericarpium Citri reticulata (Chen Pi) regulates the Qi. Bitter Radix Aucklandia (Mu Xiang) strengthens the spleen and harmonizes spleen and liver while aromatic Fructus Amomi (Sha Ren) warms the middle and dries damp. Together they improve the flow of Qi in the digestive system, thereby resolving food stagnation, distension and pain.",
        "pages": [
          6
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          5,
          6
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "Inget särskilt avsnitt med kontraindikationer eller försiktighetsåtgärder anges för denna produkt i dokumentet. Detta innebär inte att risker eller interaktioner saknas.",
        "pages": [
          5,
          6
        ],
        "kind": "unverified"
      }
    ],
    "verificationIssues": [
      {
        "code": "stomach-bai-dou-kou-sha-ren",
        "message": "Ingredienslistan anger Bai Dou Kou - amomum rotundus fructus (s. 5), medan formelförklaringen anger Fructus Amomi (Sha Ren) (s. 6). Vilken ingrediens som faktiskt ingår måste verifieras med leverantören; båda förs inte in i ingredienslistan.",
        "pages": [
          5,
          6
        ]
      }
    ],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  },
  {
    "id": "supplier-four-marvel",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Four Marvel Herbs",
    "pdfProductName": "Four Marvel herbs",
    "formulaName": "Si Miao San",
    "chineseName": null,
    "pages": [
      6,
      7
    ],
    "ingredients": [
      {
        "pinyin": "Huang Bai (sheng)",
        "botanicalName": "phellodendron cortex",
        "pages": [
          6
        ]
      },
      {
        "pinyin": "Yi Yi Ren",
        "botanicalName": "coicis praeparata semen",
        "pages": [
          6
        ]
      },
      {
        "pinyin": "Cang Zhu",
        "botanicalName": "atractylodes lancea rhizoma",
        "pages": [
          6
        ]
      },
      {
        "pinyin": "Niu Xi",
        "botanicalName": "achyranthes bidentata radix",
        "pages": [
          6
        ]
      }
    ],
    "actions": [
      {
        "text": "Drains Damp-Heat in the Lower Burner",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Reinforces Liver and Kidney",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Treats Bi-syndrome (painful wind obstruction)",
        "pages": [
          6
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "Si Miao San treats chronic problems due to Damp-Heat in the Lower Burner.",
        "pages": [
          7
        ],
        "kind": "supplier"
      },
      {
        "text": "This formula may help in case of pain in the lower back and knees, oedema in the lower legs, numbness or weakness in the legs, leukorrhea, scanty, yellow urine and a yellow, greasy coating on the tongue.",
        "pages": [
          7
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Arthrosis",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Carpal tunnel syndrome",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Constipation",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Gout",
        "pages": [
          6
        ],
        "kind": "supplier"
      },
      {
        "text": "Sciatica",
        "pages": [
          7
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Si Miao San treats chronic problems due to Damp-Heat in the Lower Burner. This formula may help in case of pain in the lower back and knees, oedema in the lower legs, numbness or weakness in the legs, leukorrhea, scanty, yellow urine and a yellow, greasy coating on the tongue. The formula is a variant on the basic formula Er Miao San which consists of rhizoma atractylodes lancea (Cang Zhu) and cortex phellondendron (Huang Bai). These two herbs dry Damp in the Lower Burner: Cang Zhu's aromatic, strong bitter taste makes it stronger at drying Damp, while Huang Bai, cold in temperature, drains Heat through the urine. Radix achyranthes bidentata (Niu Xi) and semen coicis (Yi Yi Ren) assist the abovementioned herbs with eliminating Damp-Heat. Niu Xi strengthens the Yin of the Liver and Kidney, and breaks Blood stasis in the Lower Burner. Yi Yi Ren strengthens the Spleen and dispels Wind-Damp. Since Damp interferes with the water metabolism in which the Liver, Kidney and Spleen play a key role, these organ systems will be weakened in the long-term. The addition of these herbs therefore not only emphasizes the Damp drying capacity of the formula, but also strengthens the Spleen, Liver and Kidney. temperature of the formula: cold",
        "pages": [
          7
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "temperature of the formula: cold",
        "pages": [
          7
        ],
        "kind": "supplier"
      }
    ],
    "cautions": [
      {
        "text": "Inget särskilt avsnitt med kontraindikationer eller försiktighetsåtgärder anges för denna produkt i dokumentet. Detta innebär inte att risker eller interaktioner saknas.",
        "pages": [
          6,
          7
        ],
        "kind": "unverified"
      }
    ],
    "verificationIssues": [],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters"
    ]
  },
  {
    "id": "supplier-relax-resolve",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Relax & Resolve Herbs",
    "pdfProductName": "Relax & Resolve herbs",
    "formulaName": "Hua Yu Xiao Yao San",
    "chineseName": null,
    "pages": [
      7,
      8,
      9
    ],
    "ingredients": [
      {
        "pinyin": "Chai Hu",
        "botanicalName": "bupleurum chinensis radix",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Dang Gui",
        "botanicalName": "angelica sinensis radix",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Bai Shao",
        "botanicalName": "paeonia lactiflora radix",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Bai Zhu",
        "botanicalName": "atractylodes macrocephala rhizoma",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Fu Ling",
        "botanicalName": "poria sclerotium",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Hong Hua",
        "botanicalName": "carthamus flos",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Tao Ren",
        "botanicalName": "persica semen",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Mu Dan Pi",
        "botanicalName": "moutan radicis cortex",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Zhi Zi",
        "botanicalName": "gardenia jasminoides fructus",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Bo He",
        "botanicalName": "mentha herba",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Sheng Jiang",
        "botanicalName": "zingiberis recens rhizoma",
        "pages": [
          7
        ]
      },
      {
        "pinyin": "Gan Cao (Sheng)",
        "botanicalName": "glycyrrhizha radix",
        "pages": [
          7
        ]
      }
    ],
    "actions": [
      {
        "text": "Activates Blood and resolves Blood stagnation",
        "pages": [
          7
        ],
        "kind": "supplier"
      },
      {
        "text": "Clears Heat",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Harmonizes Liver and Spleen",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Nourishes Liver Blood",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Spleen and Stomach",
        "pages": [
          8
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "In short, this is an excellent formula to simultaneously treat excess (Liver Qi stagnation and Heat) and deficiency (Blood deficiency).",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "The combination of Flos Carthamus (Hong Hua) and Semen Persica (Tao Ren) effectively moves Blood to treat Blood Stasis caused by Qi stagnation and Heat.",
        "pages": [
          9
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "ADHD",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Amenorrhea",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Anxiety",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Burnout",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Carpal tunnel syndrome",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Chronic fatigue",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Colitis ulcerosa",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Concentration weakness",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Coronary heart disease (CHD)",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Depression",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Enuresia",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Erectile dysfunction (ED)",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Fibromyalgia",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Gastroesophageal reflux",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Hair loss",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Insomnia",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Intercostal neuralgia",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Libido",
        "pages": [
          8
        ],
        "kind": "supplier"
      },
      {
        "text": "Neurose",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Plum pit syndrome",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Polycystic ovary syndrome (PCOS)",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Premenstrual syndrome (PMS)",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Restless legs",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Stress",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Vitiligo",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Abdominal distension",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Anorexia",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Infertility (female)",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "Nodules",
        "pages": [
          9
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Hua Yu Xiao Yao San is a modernized formula based on the classical formula Xiao Yao San formula. Radix Bupleurum (Chai Hu) influences the free flowing Liver Qi and disperses stagnant Qi. Radix Paeonia Lactiflora (Bai Shao) and Radix Angelica (Dang Gui) nourish Blood and soften the Liver. Radix Atractylodes (Bai Zhu) and Poria Cocos (Fu Ling) strengthen the Spleen and Stomach and thus prevent overreaction of the Liver (Wood element) to the Stomach/Spleen (Earth element). The aromatic and bitter properties of Herba Mentha (Bo He) and Rhizoma Zingiberis (Sheng Jiang) warm the Middle Jiao and support Chai Hu in spreading Liver Qi. The combination of Radix Glycyrrhiza (Gan Cao) and Radix Paeonia Lactiflora (Bai Shao) produces an analgesic effect to treat hypochondriacal tension. Fructus Gardenia (Zhi Zi) and Cortex Moutan (Mu Dan Pi) clear heat and reduce irritability, anger and other heat related symptoms. The combination of Flos Carthamus (Hong Hua) and Semen Persica (Tao Ren) effectively moves Blood to treat Blood Stasis caused by Qi stagnation and Heat. Radix Glycyrrhiza (Gan Cao) harmonizes the formula. In short, this is an excellent formula to simultaneously treat excess (Liver Qi stagnation and Heat) and deficiency (Blood deficiency).",
        "pages": [
          9
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          7,
          8,
          9
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "do not use during Wind-Cold or Wind-Heat invasion",
        "pages": [
          9
        ],
        "kind": "supplier"
      },
      {
        "text": "use with caution during pregnancy",
        "pages": [
          9
        ],
        "kind": "supplier"
      }
    ],
    "verificationIssues": [],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  },
  {
    "id": "supplier-six",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Six Herbs",
    "pdfProductName": "Six Herbs",
    "formulaName": "Liu Wei Di Huang Wan",
    "chineseName": null,
    "pages": [
      10,
      11
    ],
    "ingredients": [
      {
        "pinyin": "Shu Di Huang",
        "botanicalName": "rehmania praeparata radix",
        "pages": [
          10
        ]
      },
      {
        "pinyin": "Shan Yao",
        "botanicalName": "dioscorea opposita rhizoma",
        "pages": [
          10
        ]
      },
      {
        "pinyin": "Shan Zhu Yu",
        "botanicalName": "cornus fructus",
        "pages": [
          10
        ]
      },
      {
        "pinyin": "Fu Ling",
        "botanicalName": "poria sclerotium",
        "pages": [
          10
        ]
      },
      {
        "pinyin": "Mu Dan Pi",
        "botanicalName": "moutan radicis cortex",
        "pages": [
          10
        ]
      },
      {
        "pinyin": "Ze Xie",
        "botanicalName": "alismatis rhizoma",
        "pages": [
          10
        ]
      }
    ],
    "actions": [
      {
        "text": "Strenghtens Liver Yin",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Kidney Yin",
        "pages": [
          10
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "Strenghtens Liver Yin",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Kidney Yin",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Liu Wei Di Huang Wan is a famous Yin tonic formula.",
        "pages": [
          11
        ],
        "kind": "supplier"
      },
      {
        "text": "Cortex moutan (Mu Dan Pi) activates blood circulation to eliminate blood stasis caused by impaired Kidney Yang function and clears deficiency heat.",
        "pages": [
          11
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Burnout",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Carpal tunnel syndrome",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Concentration weakness",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Diabetes mellitus",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Fatigue",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Infertility (male)",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Low back pain",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Lumbago",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Macular degeneration",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Multiple sclerosis (MS)",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Osteoporose",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Polycystic ovary syndrome (PCOS)",
        "pages": [
          10
        ],
        "kind": "supplier"
      },
      {
        "text": "Infertility (female)",
        "pages": [
          10
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Liu Wei Di Huang Wan is a famous Yin tonic formula. It is a basic formula for more specifically applicable Yin tonic formulas such as Zhi Bai Di Huang Wan, Mai Wei Di Huang Wan and Qi Ju Di Huang Wan. Radix Rehmannia (Sheng Di Huang) in large quantities is indispensable to nourish the foundation of the Kidney with a strong Jing and Blood tonic. Rhizoma Dioscorea (Shan Yao) is a Lung and Kidney tonic with an astringent nature to help son Water through reinforcing the mother Metal. Fructus Corni (Shan Zhu Yu) is a Liver and Kidney tonic, also with an astringent nature, but this time we stimulate Mother Water through enhancing Son Liver. These three herbs work together to consolidate Kidney Jing and reinforce the Water Element which is the foundation of Kidney Qi and Yang. Rhizoma alismatis (Ze Xie) promotes urination and clears heat in the lower burner. Poria Cocos (Fu Ling) strengthens Spleen Qi and leaches out excess fluids through diuresis. Cortex moutan (Mu Dan Pi) activates blood circulation to eliminate blood stasis caused by impaired Kidney Yang function and clears deficiency heat. These three herbs nourish the Yin through strenghtening the spleen, draining damp and clearing heat, whilst they also protect the Kidney from the strong astringent properties of Sheng Di Huang, Shan Yao and Shan Zhu Yu.",
        "pages": [
          11
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          10,
          11
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "use with caution in case of dampness",
        "pages": [
          11
        ],
        "kind": "supplier"
      }
    ],
    "verificationIssues": [
      {
        "code": "six-shu-sheng-di-huang",
        "message": "Ingredienslistan anger Shu Di Huang - rehmania praeparata radix (s. 10), medan förklaringen anger Sheng Di Huang (s. 11). Bearbetningsform och faktiskt innehåll måste verifieras; förklaringen ändrar inte ingredienslistan.",
        "pages": [
          10,
          11
        ]
      }
    ],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  },
  {
    "id": "supplier-womens",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Women's Herbs",
    "pdfProductName": "Women’s herbs",
    "formulaName": "Ba Zhen Tang",
    "chineseName": null,
    "pages": [
      11,
      12
    ],
    "ingredients": [
      {
        "pinyin": "Shu Di Huang",
        "botanicalName": "rehmania praeparata radix",
        "pages": [
          11
        ]
      },
      {
        "pinyin": "Dang Gui",
        "botanicalName": "angelica sinensis radix",
        "pages": [
          11
        ]
      },
      {
        "pinyin": "Bai Shao",
        "botanicalName": "paeonia lactiflora radix",
        "pages": [
          11
        ]
      },
      {
        "pinyin": "Bai Zhu",
        "botanicalName": "atractylodes macrocephala rhizoma",
        "pages": [
          11
        ]
      },
      {
        "pinyin": "Fu Ling",
        "botanicalName": "poria sclerotium",
        "pages": [
          11
        ]
      },
      {
        "pinyin": "Ren Shen",
        "botanicalName": "ginseng radix",
        "pages": [
          11
        ]
      },
      {
        "pinyin": "Chuanxiong",
        "botanicalName": "ligusticum chuanxiong rhizoma",
        "pages": [
          11
        ]
      },
      {
        "pinyin": "Gan Cao Zhi",
        "botanicalName": "glycyrrhizha praeparata radix",
        "pages": [
          11
        ]
      }
    ],
    "actions": [
      {
        "text": "Nourishes Blood",
        "pages": [
          11
        ],
        "kind": "supplier"
      },
      {
        "text": "Strengthens Qi",
        "pages": [
          11
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "Ba Zhen Tang is a powerful Qi and Blood tonifying formula composed of two classical formulas:",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "The syndrome manifests as fatigue, lack of strength, shortness of breath, pale face, dizziness, decreased vision, pale lips and nails, palpitations, insomnia, pale tongue and weak pulse.",
        "pages": [
          12
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Amenorrhea",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Burnout",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Chronic fatigue",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Dysmenorhea",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Fatigue",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Hair loss",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Headache",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Hypotension",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Infertility (male)",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Muscle cramps in lower limbs",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Nervousness",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Vertigo",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Anemia",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Infertility (female)",
        "pages": [
          12
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Ba Zhen Tang is a powerful Qi and Blood tonifying formula composed of two classical formulas: 1. Nourishing Blood with Si Wu = Radix Rehmanniae (Shu Di Huang), Radix Angelicae sinensis (Dang Gui), Radix Paeoniae (Bai Shao), Rhizoma Chuanxiong (Chuan Xiong) 2. Tonifying Qi with Si Jun Zi = Rhizoma Atractylodis macrocephalae (Bai Zhu), Poria (Fu Ling), Radix et Rhizoma Ginseng (Ren Shen), Radix et Rhizoma Glycyrrhizae (Zhi Gan Cao) It is used to improve the function of Spleen and Stomach, strengthen energy and nourish the Blood in order to generally supplement Qi and Blood. The syndrome manifests as fatigue, lack of strength, shortness of breath, pale face, dizziness, decreased vision, pale lips and nails, palpitations, insomnia, pale tongue and weak pulse.",
        "pages": [
          12
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          11,
          12
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "As long as the client shows signs of weakness, this formula is suitable.If the client shows a Heat or Excess condition, Ba Zhen Tang is not the best formula or not sufficient.",
        "pages": [
          12
        ],
        "kind": "supplier"
      },
      {
        "text": "Contraindicated in case of acute infections such as colds and flu",
        "pages": [
          12
        ],
        "kind": "supplier"
      }
    ],
    "verificationIssues": [],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  },
  {
    "id": "supplier-slbz",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "SLBZ Herbs",
    "pdfProductName": "SLBZ HERBS",
    "formulaName": "Shen Ling Bai Zhu San",
    "chineseName": null,
    "pages": [
      13,
      14
    ],
    "ingredients": [
      {
        "pinyin": "Bai Zhu",
        "botanicalName": "atractylodes macrocephala rhizoma",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Fu Ling",
        "botanicalName": "poria sclerotium",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Gan Cao Zhi",
        "botanicalName": "glycyrrhizha praeparata radix",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Ren Shen",
        "botanicalName": "ginseng radix",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Shan Yao",
        "botanicalName": "dioscorea opposita rhizoma",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Jie Geng",
        "botanicalName": "platycodon radix",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Bai Lian Zi",
        "botanicalName": "nelumbinis semen",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Sha Ren",
        "botanicalName": "amomum villosum fructus",
        "pages": [
          13
        ]
      },
      {
        "pinyin": "Yi Yi Ren",
        "botanicalName": "coicis praeparata semen",
        "pages": [
          13
        ]
      }
    ],
    "actions": [
      {
        "text": "Harmonizes the Middle Jiao",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Promotes urination and leaches out Dampness",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Raises the Yang",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Reduces diarrhea",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Strenghtens Spleen",
        "pages": [
          13
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "Shen Ling Bai Zhu San treats primarily the patterns spleen Qi deficiency and damp which manifests as difficult digestion, diarrhoea or loose stools, little appetite, lethargy and weakness in the muscles.",
        "pages": [
          14
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Anti-aging",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Chronic fatigue",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Colitis ulcerosa",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Crohn's disease",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Diarrhea",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Edema",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Fatigue",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Hypercholesterolemia",
        "pages": [
          13
        ],
        "kind": "supplier"
      },
      {
        "text": "Irritable bowel syndrome (IBS)",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Multiple sclerosis (MS)",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Obesity",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Shingles",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Ulcer of stomach or duodenum",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Abdominal distension",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Anorexia",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Nodules",
        "pages": [
          14
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Shen Ling Bai Zhu San treats primarily the patterns spleen Qi deficiency and damp which manifests as difficult digestion, diarrhoea or loose stools, little appetite, lethargy and weakness in the muscles. This herbal formula is based on Si Jun Zi Tang which consists of Radix Ginseng (Ren Shen), Radix Glycyrrhiza preparata (Gan Cao Zhi), Rhizoma Atractylodes (Bai Zhu) and Sclerotium Poria Cocos (Fu Ling). These four herbs aim to strengthen the Middle Qi. They are combined with sweet herbs Rhizoma dioscoreae (Shan Yao), Semen coicis (Yi Yi Ren), Semen Lablab (Bai Bian Dou) and Semen Nelumbinis (Bai Lian Zi) to assist Radix Atractylodes (Bai Zhu) to strengthen the spleen, dispel damp and stop diarrhea. The addition of Fructus amomi (Sha Ren), a bitter, warm and aromatic herb, stimulates the spleen and releases blockages to restore the Middle Qi. It also stops vomiting and diarrhoea. Radix Platycodonis (Jie Geng) guides the formula to the Tai Yin Long meridian to help the other herbs ascend and spread their effect to the Upper Warmer to stimulate the lungs. That's why this herbal formula can also be used to resolve Long Qi deficiency with long-term cough and phlegm. This is based on the principle of reinforcing Earth to generate Metal. This formula warms and stimulates the spleen, and eliminates phlegm without being drying. Therefore it is a broad spectrum earth reinforcing formula that can be used in a wide range of applications. It can be suitable in weakened chemo patients or in complicated conditions in case the patient cannot assimilate the other herbs properly.",
        "pages": [
          14
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          13,
          14
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "This formula does not contain heat-clearing herbs, so it is not suitable in case the complaints are caused by a heat condition.",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "In case of general weakness: if you don't know where to start, start with nourishing the earth. This is a suitable formula, eg. after chemotherapy.",
        "pages": [
          14
        ],
        "kind": "supplier"
      },
      {
        "text": "Not in case of constipation due to the fact that Yi Yi Ren has a constipating action.",
        "pages": [
          14
        ],
        "kind": "supplier"
      }
    ],
    "verificationIssues": [
      {
        "code": "slbz-bai-bian-dou-not-listed",
        "message": "Semen Lablab (Bai Bian Dou) beskrivs i förklaringen (s. 14) men saknas i den uppräknade ingredienslistan (s. 13). Ingrediensen läggs inte till utan leverantörens bekräftelse.",
        "pages": [
          13,
          14
        ]
      }
    ],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  },
  {
    "id": "supplier-auranthii",
    "supplier": "China Nature",
    "document": "rangejohan.pdf",
    "documentSha256": "70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0",
    "productName": "Auranthii Herbs",
    "pdfProductName": "Auranthii herbs",
    "formulaName": "Chai Hu Shu Gan San",
    "chineseName": null,
    "pages": [
      15,
      16
    ],
    "ingredients": [
      {
        "pinyin": "Chai Hu",
        "botanicalName": "bupleurum chinensis radix",
        "pages": [
          15
        ]
      },
      {
        "pinyin": "Chen pi",
        "botanicalName": "citrus reticulata pericarpium",
        "pages": [
          15
        ]
      },
      {
        "pinyin": "Bai Shao",
        "botanicalName": "paeonia lactiflora radix",
        "pages": [
          15
        ]
      },
      {
        "pinyin": "Chuanxiong",
        "botanicalName": "ligusticum chuanxiong rhizoma",
        "pages": [
          15
        ]
      },
      {
        "pinyin": "Zhi Qiao (Chao)",
        "botanicalName": "citrus aurantium immaturus (dry-fried) fructus",
        "pages": [
          15
        ]
      },
      {
        "pinyin": "Xiang Fu",
        "botanicalName": "cyperus rotundus rhizoma",
        "pages": [
          15
        ]
      },
      {
        "pinyin": "Gan Cao (Sheng)",
        "botanicalName": "glycyrrhizha radix",
        "pages": [
          15
        ]
      }
    ],
    "actions": [
      {
        "text": "Alleviates pain",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Expels Liver Qi Stagnation and spreads Liver Qi",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Harmonizes Liver and Spleen",
        "pages": [
          15
        ],
        "kind": "supplier"
      }
    ],
    "traditionalPatterns": [
      {
        "text": "Chai Hu Shu Gan San helps with Liver Qi stagnation caused by emotional stress.",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "This formula is useful for Excess conditions characterized by abdominal distension and flank pain due to internal tension and emotions such as anger, irritability and frustrations.",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "This is also a suitable formula for digestive complaints caused by Wood attacking Earth.",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "If aside from the pattern of Qi stagnation also other patterns occur, for example Blood deficiency, it may be designated to combine this formula with another tonifying formulas.",
        "pages": [
          16
        ],
        "kind": "supplier"
      }
    ],
    "indications": [
      {
        "text": "Gastritis (atrophic)",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Gastroesophageal reflux",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Intercostal neuralgia",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Premenstrual syndrome (PMS)",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Raynaud's disease",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Stomach complaints (dyspepsia)",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Trapezius syndrome",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Ulcer of stomach or duodenum",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "Abdominal distension",
        "pages": [
          15
        ],
        "kind": "supplier"
      }
    ],
    "explanation": [
      {
        "text": "Chai Hu Shu Gan San helps with Liver Qi stagnation caused by emotional stress. This formula is useful for Excess conditions characterized by abdominal distension and flank pain due to internal tension and emotions such as anger, irritability and frustrations. This is also a suitable formula for digestive complaints caused by Wood attacking Earth.",
        "pages": [
          15
        ],
        "kind": "supplier"
      },
      {
        "text": "If aside from the pattern of Qi stagnation also other patterns occur, for example Blood deficiency, it may be designated to combine this formula with another tonifying formulas. In any case, Chai Hu Shu Gan San is a purely Qi regulating formula, meaning it is not suitable for long term use. When symptoms subside (e.g. after one dose or one month), treatment should focus on the cause of the stagnation. The main ingredient of this formula is Radix Bupleurum (Chai Hu). Chai Hu is a pungent and cool herb with the capacity to raise, disperse, regulate and soothe blocked Liver Qi. Pericarpium Citri Reticulation (Chen Pi), Rhizoma Cyperi (Xiang Fu) and fructus aurantii (Zhi Qiao) belong to the category of Qi regulating herbs. Pericarpium Citri Reticulation (Chen Pi) regulates the Middle and supports the transportation of Spleen. Rhizoma Cyperi (Xiang Fu) regulates Liver Qi and soothes pain. Fructus aurantii (Zhi Qiao) promotes the Middle Qi and eliminates food stagnation. Rhizoma Ligusticum (Chuan Xiong) regulates Qi and stimulates blood circulation. Radix Paeonia Lactiflora (Bai Shao) is a still herb with a soothing effect on overactive Liver Yang and pain. Also, the Blood nourishing and Yin preserving action compensates for the strong regulating action of the formula. Radix Glycyrrhiza (Gan Cao) strengthens the Spleen and has a harmonizing effect. Moreover Gan Cao and Bai Shao work synergistically to soothe abdominal pain due to disharmony between the Liver and Stomach.",
        "pages": [
          16
        ],
        "kind": "supplier"
      }
    ],
    "temperature": [
      {
        "text": "Någon uttrycklig temperaturklassificering av den samlade formeln anges inte. Temperaturer för enskilda örter och värmande/kylande Actions ska inte likställas med verifierad slutproduktklassificering.",
        "pages": [
          15,
          16
        ],
        "kind": "unverified"
      }
    ],
    "cautions": [
      {
        "text": "for short term use (eg. one month)",
        "pages": [
          16
        ],
        "kind": "supplier"
      }
    ],
    "verificationIssues": [],
    "unverifiedFields": [
      "ingredientAmounts",
      "productStrength",
      "extractionRatio",
      "finishedProductSpecification",
      "batchIdentityAndQuality",
      "contaminantTesting",
      "completeSafetyAndInteractions",
      "regulatoryStatus",
      "chineseCharacters",
      "overallFormulaTemperature"
    ]
  }
];
