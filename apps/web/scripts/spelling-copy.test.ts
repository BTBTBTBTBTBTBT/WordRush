import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Wordocious is written in American English (founder, 2026-09-24: "everywhere the
 * word colour appears … adjust to color as it should be spelled", then "do the same
 * pass for all British spellings, I don't want any of those appearing"). This greps
 * the copy the player can read — string literals, JSX text and comments in the web
 * app, every puzzle bank's text fields, the dictionary's definitions and the shared
 * catalog — for 1678 British forms (-our, -re, -ise, doubled-l, grey, plough …).
 *
 * Deliberately NOT scanned: word lists and puzzle ANSWERS (COLOUR, GREY, TSAR are
 * legitimate guesses and answers; changing an answer changes the puzzle), dictionary
 * KEYS (the headword for a British-spelled valid guess), the crossword theme key, and
 * identifiers in code (`centre`, `hubCentre`, the 'cancelled' invite status is a DB
 * value). A hit here means a player-visible British spelling has crept back in.
 */
const ROOT = join(__dirname, '..');
const DIRS = ['app', 'components', 'lib', 'hooks', 'data'].map((d) => join(ROOT, d));
const CATALOG = join(ROOT, '..', '..', 'packages', 'core', 'modes.json');
const SKIP = /^(allowed(-\d)?|solutions(-\d)?(-legacy)?|.*lexicon.*|hub-puzzles|wordsearch-puzzles|wordsearch-themes|propernoundle-puzzles|propernoundle-holidays|sense-rank-fixtures|ladder-puzzles)\.json$/;
/** Exact literals that are stored values, not copy: [file suffix, word]. */
const ALLOW: [string, string][] = [['lib/invite-service.ts', 'cancelled']]; // invites.status enum value in the database
const WORDS = [
  'aeroplane', 'aeroplanes', 'ageing', 'agonisable', 'agonisation', 'agonisations', 'agonise', 'agonised', 'agoniser', 'agonisers', 'agonises', 'agonising', 'alphabetisable', 'alphabetisation',
  'alphabetisations', 'alphabetise', 'alphabetised', 'alphabetiser', 'alphabetisers', 'alphabetises', 'alphabetising', 'aluminium', 'amongst', 'anaemia', 'anaemic', 'anaesthetisable', 'anaesthetisation', 'anaesthetisations',
  'anaesthetise', 'anaesthetised', 'anaesthetiser', 'anaesthetisers', 'anaesthetises', 'anaesthetising', 'analysable', 'analyse', 'analysed', 'analyser', 'analysers', 'analysing', 'annexe', 'antagonisable',
  'antagonisation', 'antagonisations', 'antagonise', 'antagonised', 'antagoniser', 'antagonisers', 'antagonises', 'antagonising', 'apologisable', 'apologisation', 'apologisations', 'apologise', 'apologised', 'apologiser',
  'apologisers', 'apologises', 'apologising', 'apostrophisable', 'apostrophisation', 'apostrophisations', 'apostrophise', 'apostrophised', 'apostrophiser', 'apostrophisers', 'apostrophises', 'apostrophising', 'appal', 'ardour',
  'armour', 'armoured', 'armoury', 'artefact', 'artefacts', 'authorisable', 'authorisation', 'authorisations', 'authorise', 'authorised', 'authoriser', 'authorisers', 'authorises', 'authorising',
  'baptisable', 'baptisation', 'baptisations', 'baptise', 'baptised', 'baptiser', 'baptisers', 'baptises', 'baptising', 'behaviour', 'behavioural', 'behaviours', 'breathalysable', 'breathalyse',
  'breathalysed', 'breathalyser', 'breathalysers', 'breathalyses', 'breathalysing', 'burglarisable', 'burglarisation', 'burglarisations', 'burglarise', 'burglarised', 'burglariser', 'burglarisers', 'burglarises', 'burglarising',
  'calibre', 'cancelled', 'cancelling', 'candour', 'capitalisable', 'capitalisation', 'capitalisations', 'capitalise', 'capitalised', 'capitaliser', 'capitalisers', 'capitalises', 'capitalising', 'caramelisable',
  'caramelisation', 'caramelisations', 'caramelise', 'caramelised', 'carameliser', 'caramelisers', 'caramelises', 'caramelising', 'carburettor', 'catalogue', 'catalogued', 'catalogues', 'catalysable', 'catalyse',
  'catalysed', 'catalyser', 'catalysers', 'catalyses', 'catalysing', 'categorisable', 'categorisation', 'categorisations', 'categorise', 'categorised', 'categoriser', 'categorisers', 'categorises', 'categorising',
  'centimetre', 'centimetres', 'centralisable', 'centralisation', 'centralisations', 'centralise', 'centralised', 'centraliser', 'centralisers', 'centralises', 'centralising', 'centre', 'centred', 'centrepiece',
  'centres', 'centring', 'channelled', 'characterisable', 'characterisation', 'characterisations', 'characterise', 'characterised', 'characteriser', 'characterisers', 'characterises', 'characterising', 'chilli', 'chillies',
  'chiselled', 'civilisable', 'civilisation', 'civilisations', 'civilise', 'civilised', 'civiliser', 'civilisers', 'civilises', 'civilising', 'clamour', 'colonisable', 'colonisation', 'colonisations',
  'colonise', 'colonised', 'coloniser', 'colonisers', 'colonises', 'colonising', 'colour', 'colouration', 'colourblind', 'coloured', 'colourful', 'colouring', 'colourless', 'colours',
  'computerisable', 'computerisation', 'computerisations', 'computerise', 'computerised', 'computeriser', 'computerisers', 'computerises', 'computerising', 'containerisable', 'containerisation', 'containerisations', 'containerise', 'containerised',
  'containeriser', 'containerisers', 'containerises', 'containerising', 'cosier', 'cosiest', 'cosy', 'councillor', 'counsellor', 'criticisable', 'criticisation', 'criticisations', 'criticise', 'criticised',
  'criticiser', 'criticisers', 'criticises', 'criticising', 'crystallisable', 'crystallisation', 'crystallisations', 'crystallise', 'crystallised', 'crystalliser', 'crystallisers', 'crystallises', 'crystallising', 'customisable',
  'customisation', 'customisations', 'customise', 'customised', 'customiser', 'customisers', 'customises', 'customising', 'cypher', 'decimalisable', 'decimalisation', 'decimalisations', 'decimalise', 'decimalised',
  'decimaliser', 'decimalisers', 'decimalises', 'decimalising', 'defence', 'defences', 'demeanour', 'demonisable', 'demonisation', 'demonisations', 'demonise', 'demonised', 'demoniser', 'demonisers',
  'demonises', 'demonising', 'demoralisable', 'demoralisation', 'demoralisations', 'demoralise', 'demoralised', 'demoraliser', 'demoralisers', 'demoralises', 'demoralising', 'deodorisable', 'deodorisation', 'deodorisations',
  'deodorise', 'deodorised', 'deodoriser', 'deodorisers', 'deodorises', 'deodorising', 'despatch', 'destabilisable', 'destabilisation', 'destabilisations', 'destabilise', 'destabilised', 'destabiliser', 'destabilisers',
  'destabilises', 'destabilising', 'dialled', 'dialling', 'diarrhoea', 'digitisable', 'digitisation', 'digitisations', 'digitise', 'digitised', 'digitiser', 'digitisers', 'digitises', 'digitising',
  'discolouration', 'discoloured', 'dishonour', 'distil', 'dramatisable', 'dramatisation', 'dramatisations', 'dramatise', 'dramatised', 'dramatiser', 'dramatisers', 'dramatises', 'dramatising', 'economisable',
  'economisation', 'economisations', 'economise', 'economised', 'economiser', 'economisers', 'economises', 'economising', 'electrolysable', 'electrolyse', 'electrolysed', 'electrolyser', 'electrolysers', 'electrolyses',
  'electrolysing', 'emphasisable', 'emphasisation', 'emphasisations', 'emphasise', 'emphasised', 'emphasiser', 'emphasisers', 'emphasises', 'emphasising', 'encyclopaedia', 'endeavour', 'endeavours', 'energisable',
  'energisation', 'energisations', 'energise', 'energised', 'energiser', 'energisers', 'energises', 'energising', 'enrol', 'enrolment', 'enrols', 'epitomisable', 'epitomisation', 'epitomisations',
  'epitomise', 'epitomised', 'epitomiser', 'epitomisers', 'epitomises', 'epitomising', 'equalisable', 'equalisation', 'equalisations', 'equalise', 'equalised', 'equaliser', 'equalisers', 'equalises',
  'equalising', 'equalled', 'eulogisable', 'eulogisation', 'eulogisations', 'eulogise', 'eulogised', 'eulogiser', 'eulogisers', 'eulogises', 'eulogising', 'evangelisable', 'evangelisation', 'evangelisations',
  'evangelise', 'evangelised', 'evangeliser', 'evangelisers', 'evangelises', 'evangelising', 'externalisable', 'externalisation', 'externalisations', 'externalise', 'externalised', 'externaliser', 'externalisers', 'externalises',
  'externalising', 'familiarisable', 'familiarisation', 'familiarisations', 'familiarise', 'familiarised', 'familiariser', 'familiarisers', 'familiarises', 'familiarising', 'fantasisable', 'fantasisation', 'fantasisations', 'fantasise',
  'fantasised', 'fantasiser', 'fantasisers', 'fantasises', 'fantasising', 'favour', 'favourable', 'favoured', 'favourite', 'favourites', 'favours', 'fertilisable', 'fertilisation', 'fertilisations',
  'fertilise', 'fertilised', 'fertiliser', 'fertilisers', 'fertilises', 'fertilising', 'fervour', 'fibre', 'fibres', 'finalisable', 'finalisation', 'finalisations', 'finalise', 'finalised',
  'finaliser', 'finalisers', 'finalises', 'finalising', 'flavour', 'flavoured', 'flavourful', 'flavouring', 'flavours', 'foetus', 'formalisable', 'formalisation', 'formalisations', 'formalise',
  'formalised', 'formaliser', 'formalisers', 'formalises', 'formalising', 'fossilisable', 'fossilisation', 'fossilisations', 'fossilise', 'fossilised', 'fossiliser', 'fossilisers', 'fossilises', 'fossilising',
  'fraternisable', 'fraternisation', 'fraternisations', 'fraternise', 'fraternised', 'fraterniser', 'fraternisers', 'fraternises', 'fraternising', 'fuelled', 'fuelling', 'fulfil', 'fulfilment', 'fulfils',
  'furore', 'galvanisable', 'galvanisation', 'galvanisations', 'galvanise', 'galvanised', 'galvaniser', 'galvanisers', 'galvanises', 'galvanising', 'gaol', 'generalisable', 'generalisation', 'generalisations',
  'generalise', 'generalised', 'generaliser', 'generalisers', 'generalises', 'generalising', 'globalisable', 'globalisation', 'globalisations', 'globalise', 'globalised', 'globaliser', 'globalisers', 'globalises',
  'globalising', 'gramme', 'grammes', 'grey', 'grey-haired', 'greyed', 'greyer', 'greyest', 'greying', 'greyish', 'greys', 'grovelling', 'haemorrhage', 'harbour',
  'harboured', 'harbours', 'harmonisable', 'harmonisation', 'harmonisations', 'harmonise', 'harmonised', 'harmoniser', 'harmonisers', 'harmonises', 'harmonising', 'homogenisable', 'homogenisation', 'homogenisations',
  'homogenise', 'homogenised', 'homogeniser', 'homogenisers', 'homogenises', 'homogenising', 'honour', 'honourable', 'honoured', 'honours', 'hospitalisable', 'hospitalisation', 'hospitalisations', 'hospitalise',
  'hospitalised', 'hospitaliser', 'hospitalisers', 'hospitalises', 'hospitalising', 'humanisable', 'humanisation', 'humanisations', 'humanise', 'humanised', 'humaniser', 'humanisers', 'humanises', 'humanising',
  'humour', 'humoured', 'humours', 'hydrolysable', 'hydrolyse', 'hydrolysed', 'hydrolyser', 'hydrolysers', 'hydrolyses', 'hydrolysing', 'hypnotisable', 'hypnotisation', 'hypnotisations', 'hypnotise',
  'hypnotised', 'hypnotiser', 'hypnotisers', 'hypnotises', 'hypnotising', 'idealisable', 'idealisation', 'idealisations', 'idealise', 'idealised', 'idealiser', 'idealisers', 'idealises', 'idealising',
  'immortalisable', 'immortalisation', 'immortalisations', 'immortalise', 'immortalised', 'immortaliser', 'immortalisers', 'immortalises', 'immortalising', 'immunisable', 'immunisation', 'immunisations', 'immunise', 'immunised',
  'immuniser', 'immunisers', 'immunises', 'immunising', 'individualisable', 'individualisation', 'individualisations', 'individualise', 'individualised', 'individualiser', 'individualisers', 'individualises', 'individualising', 'industrialisable',
  'industrialisation', 'industrialisations', 'industrialise', 'industrialised', 'industrialiser', 'industrialisers', 'industrialises', 'industrialising', 'initialisable', 'initialisation', 'initialisations', 'initialise', 'initialised', 'initialiser',
  'initialisers', 'initialises', 'initialising', 'instalment', 'instalments', 'instil', 'internalisable', 'internalisation', 'internalisations', 'internalise', 'internalised', 'internaliser', 'internalisers', 'internalises',
  'internalising', 'italicisable', 'italicisation', 'italicisations', 'italicise', 'italicised', 'italiciser', 'italicisers', 'italicises', 'italicising', 'jeopardisable', 'jeopardisation', 'jeopardisations', 'jeopardise',
  'jeopardised', 'jeopardiser', 'jeopardisers', 'jeopardises', 'jeopardising', 'jeweller', 'jewellery', 'judgement', 'judgements', 'kerb', 'kerbs', 'kilometre', 'kilometres', 'labelled',
  'labelling', 'labour', 'laboured', 'labourer', 'labourers', 'labours', 'learnt', 'legalisable', 'legalisation', 'legalisations', 'legalise', 'legalised', 'legaliser', 'legalisers',
  'legalises', 'legalising', 'legitimisable', 'legitimisation', 'legitimisations', 'legitimise', 'legitimised', 'legitimiser', 'legitimisers', 'legitimises', 'legitimising', 'leukaemia', 'levelled', 'levelling',
  'liberalisable', 'liberalisation', 'liberalisations', 'liberalise', 'liberalised', 'liberaliser', 'liberalisers', 'liberalises', 'liberalising', 'licence', 'licences', 'lionisable', 'lionisation', 'lionisations',
  'lionise', 'lionised', 'lioniser', 'lionisers', 'lionises', 'lionising', 'liquorice', 'litre', 'litres', 'localisable', 'localisation', 'localisations', 'localise', 'localised',
  'localiser', 'localisers', 'localises', 'localising', 'louvre', 'lustre', 'magnetisable', 'magnetisation', 'magnetisations', 'magnetise', 'magnetised', 'magnetiser', 'magnetisers', 'magnetises',
  'magnetising', 'manoeuvre', 'manoeuvres', 'manoeuvring', 'marginalisable', 'marginalisation', 'marginalisations', 'marginalise', 'marginalised', 'marginaliser', 'marginalisers', 'marginalises', 'marginalising', 'marvelled',
  'marvellous', 'materialisable', 'materialisation', 'materialisations', 'materialise', 'materialised', 'materialiser', 'materialisers', 'materialises', 'materialising', 'maximisable', 'maximisation', 'maximisations', 'maximise',
  'maximised', 'maximiser', 'maximisers', 'maximises', 'maximising', 'meagre', 'mechanisable', 'mechanisation', 'mechanisations', 'mechanise', 'mechanised', 'mechaniser', 'mechanisers', 'mechanises',
  'mechanising', 'mediaeval', 'memorialisable', 'memorialisation', 'memorialisations', 'memorialise', 'memorialised', 'memorialiser', 'memorialisers', 'memorialises', 'memorialising', 'memorisable', 'memorisation', 'memorisations',
  'memorise', 'memorised', 'memoriser', 'memorisers', 'memorises', 'memorising', 'mesmerisable', 'mesmerisation', 'mesmerisations', 'mesmerise', 'mesmerised', 'mesmeriser', 'mesmerisers', 'mesmerises',
  'mesmerising', 'metabolisable', 'metabolisation', 'metabolisations', 'metabolise', 'metabolised', 'metaboliser', 'metabolisers', 'metabolises', 'metabolising', 'metre', 'metres', 'militarisable', 'militarisation',
  'militarisations', 'militarise', 'militarised', 'militariser', 'militarisers', 'militarises', 'militarising', 'millimetre', 'millimetres', 'miniaturisable', 'miniaturisation', 'miniaturisations', 'miniaturise', 'miniaturised',
  'miniaturiser', 'miniaturisers', 'miniaturises', 'miniaturising', 'minimisable', 'minimisation', 'minimisations', 'minimise', 'minimised', 'minimiser', 'minimisers', 'minimises', 'minimising', 'misbehaviour',
  'mobilisable', 'mobilisation', 'mobilisations', 'mobilise', 'mobilised', 'mobiliser', 'mobilisers', 'mobilises', 'mobilising', 'modelled', 'modelling', 'modernisable', 'modernisation', 'modernisations',
  'modernise', 'modernised', 'moderniser', 'modernisers', 'modernises', 'modernising', 'modularisable', 'modularisation', 'modularisations', 'modularise', 'modularised', 'modulariser', 'modularisers', 'modularises',
  'modularising', 'mollusc', 'molluscs', 'monetisable', 'monetisation', 'monetisations', 'monetise', 'monetised', 'monetiser', 'monetisers', 'monetises', 'monetising', 'monopolisable', 'monopolisation',
  'monopolisations', 'monopolise', 'monopolised', 'monopoliser', 'monopolisers', 'monopolises', 'monopolising', 'moralisable', 'moralisation', 'moralisations', 'moralise', 'moralised', 'moraliser', 'moralisers',
  'moralises', 'moralising', 'motorisable', 'motorisation', 'motorisations', 'motorise', 'motorised', 'motoriser', 'motorisers', 'motorises', 'motorising', 'mould', 'moulded', 'moulding',
  'moulds', 'mouldy', 'moustache', 'moustaches', 'multicoloured', 'nasalisable', 'nasalisation', 'nasalisations', 'nasalise', 'nasalised', 'nasaliser', 'nasalisers', 'nasalises', 'nasalising',
  'nationalisable', 'nationalisation', 'nationalisations', 'nationalise', 'nationalised', 'nationaliser', 'nationalisers', 'nationalises', 'nationalising', 'naturalisable', 'naturalisation', 'naturalisations', 'naturalise', 'naturalised',
  'naturaliser', 'naturalisers', 'naturalises', 'naturalising', 'neighbour', 'neighbourhood', 'neighbourhoods', 'neighbouring', 'neighbourly', 'neighbours', 'neutralisable', 'neutralisation', 'neutralisations', 'neutralise',
  'neutralised', 'neutraliser', 'neutralisers', 'neutralises', 'neutralising', 'normalisable', 'normalisation', 'normalisations', 'normalise', 'normalised', 'normaliser', 'normalisers', 'normalises', 'normalising',
  'odour', 'odourless', 'odours', 'oesophagus', 'offence', 'offences', 'optimisable', 'optimisation', 'optimisations', 'optimise', 'optimised', 'optimiser', 'optimisers', 'optimises',
  'optimising', 'organisable', 'organisation', 'organisations', 'organise', 'organised', 'organiser', 'organisers', 'organises', 'organising', 'orthopaedic', 'oxidisable', 'oxidisation', 'oxidisations',
  'oxidise', 'oxidised', 'oxidiser', 'oxidisers', 'oxidises', 'oxidising', 'paediatric', 'paralysable', 'paralyse', 'paralysed', 'paralyser', 'paralysers', 'paralyses', 'paralysing',
  'parlour', 'pasteurisable', 'pasteurisation', 'pasteurisations', 'pasteurise', 'pasteurised', 'pasteuriser', 'pasteurisers', 'pasteurises', 'pasteurising', 'patronisable', 'patronisation', 'patronisations', 'patronise',
  'patronised', 'patroniser', 'patronisers', 'patronises', 'patronising', 'pedlar', 'penalisable', 'penalisation', 'penalisations', 'penalise', 'penalised', 'penaliser', 'penalisers', 'penalises',
  'penalising', 'pencilled', 'pencilling', 'personalisable', 'personalisation', 'personalisations', 'personalise', 'personalised', 'personaliser', 'personalisers', 'personalises', 'personalising', 'philosophisable', 'philosophisation',
  'philosophisations', 'philosophise', 'philosophised', 'philosophiser', 'philosophisers', 'philosophises', 'philosophising', 'plagiarisable', 'plagiarisation', 'plagiarisations', 'plagiarise', 'plagiarised', 'plagiariser', 'plagiarisers',
  'plagiarises', 'plagiarising', 'plough', 'ploughed', 'ploughing', 'ploughman', 'ploughs', 'polarisable', 'polarisation', 'polarisations', 'polarise', 'polarised', 'polariser', 'polarisers',
  'polarises', 'polarising', 'popularisable', 'popularisation', 'popularisations', 'popularise', 'popularised', 'populariser', 'popularisers', 'popularises', 'popularising', 'practise', 'practised', 'practising',
  'pressurisable', 'pressurisation', 'pressurisations', 'pressurise', 'pressurised', 'pressuriser', 'pressurisers', 'pressurises', 'pressurising', 'pretence', 'prioritisable', 'prioritisation', 'prioritisations', 'prioritise',
  'prioritised', 'prioritiser', 'prioritisers', 'prioritises', 'prioritising', 'privatisable', 'privatisation', 'privatisations', 'privatise', 'privatised', 'privatiser', 'privatisers', 'privatises', 'privatising',
  'programme', 'programmes', 'publicisable', 'publicisation', 'publicisations', 'publicise', 'publicised', 'publiciser', 'publicisers', 'publicises', 'publicising', 'pulverisable', 'pulverisation', 'pulverisations',
  'pulverise', 'pulverised', 'pulveriser', 'pulverisers', 'pulverises', 'pulverising', 'pyjamas', 'quarrelled', 'radicalisable', 'radicalisation', 'radicalisations', 'radicalise', 'radicalised', 'radicaliser',
  'radicalisers', 'radicalises', 'radicalising', 'rancour', 'randomisable', 'randomisation', 'randomisations', 'randomise', 'randomised', 'randomiser', 'randomisers', 'randomises', 'randomising', 'rationalisable',
  'rationalisation', 'rationalisations', 'rationalise', 'rationalised', 'rationaliser', 'rationalisers', 'rationalises', 'rationalising', 'realisable', 'realisation', 'realisations', 'realise', 'realised', 'realiser',
  'realisers', 'realises', 'realising', 'recognisable', 'recognisation', 'recognisations', 'recognise', 'recognised', 'recogniser', 'recognisers', 'recognises', 'recognising', 'revolutionisable', 'revolutionisation',
  'revolutionisations', 'revolutionise', 'revolutionised', 'revolutioniser', 'revolutionisers', 'revolutionises', 'revolutionising', 'rivalled', 'romanticisable', 'romanticisation', 'romanticisations', 'romanticise', 'romanticised', 'romanticiser',
  'romanticisers', 'romanticises', 'romanticising', 'rumour', 'rumoured', 'rumours', 'sabre', 'satirisable', 'satirisation', 'satirisations', 'satirise', 'satirised', 'satiriser', 'satirisers',
  'satirises', 'satirising', 'saviour', 'savour', 'savoured', 'savoury', 'sceptic', 'sceptical', 'scepticism', 'sceptre', 'scrutinisable', 'scrutinisation', 'scrutinisations', 'scrutinise',
  'scrutinised', 'scrutiniser', 'scrutinisers', 'scrutinises', 'scrutinising', 'sensitisable', 'sensitisation', 'sensitisations', 'sensitise', 'sensitised', 'sensitiser', 'sensitisers', 'sensitises', 'sensitising',
  'serialisable', 'serialisation', 'serialisations', 'serialise', 'serialised', 'serialiser', 'serialisers', 'serialises', 'serialising', 'sexualisable', 'sexualisation', 'sexualisations', 'sexualise', 'sexualised',
  'sexualiser', 'sexualisers', 'sexualises', 'sexualising', 'shrivelled', 'signalled', 'signalling', 'skilful', 'skilfully', 'snivelling', 'socialisable', 'socialisation', 'socialisations', 'socialise',
  'socialised', 'socialiser', 'socialisers', 'socialises', 'socialising', 'solemnisable', 'solemnisation', 'solemnisations', 'solemnise', 'solemnised', 'solemniser', 'solemnisers', 'solemnises', 'solemnising',
  'sombre', 'specialisable', 'specialisation', 'specialisations', 'specialise', 'specialised', 'specialiser', 'specialisers', 'specialises', 'specialising', 'spectre', 'spiralled', 'splendour', 'stabilisable',
  'stabilisation', 'stabilisations', 'stabilise', 'stabilised', 'stabiliser', 'stabilisers', 'stabilises', 'stabilising', 'standardisable', 'standardisation', 'standardisations', 'standardise', 'standardised', 'standardiser',
  'standardisers', 'standardises', 'standardising', 'sterilisable', 'sterilisation', 'sterilisations', 'sterilise', 'sterilised', 'steriliser', 'sterilisers', 'sterilises', 'sterilising', 'stigmatisable', 'stigmatisation',
  'stigmatisations', 'stigmatise', 'stigmatised', 'stigmatiser', 'stigmatisers', 'stigmatises', 'stigmatising', 'stylisable', 'stylisation', 'stylisations', 'stylise', 'stylised', 'styliser', 'stylisers',
  'stylises', 'stylising', 'subsidisable', 'subsidisation', 'subsidisations', 'subsidise', 'subsidised', 'subsidiser', 'subsidisers', 'subsidises', 'subsidising', 'succour', 'sulphur', 'summarisable',
  'summarisation', 'summarisations', 'summarise', 'summarised', 'summariser', 'summarisers', 'summarises', 'summarising', 'symbolisable', 'symbolisation', 'symbolisations', 'symbolise', 'symbolised', 'symboliser',
  'symbolisers', 'symbolises', 'symbolising', 'sympathisable', 'sympathisation', 'sympathisations', 'sympathise', 'sympathised', 'sympathiser', 'sympathisers', 'sympathises', 'sympathising', 'synchronisable', 'synchronisation',
  'synchronisations', 'synchronise', 'synchronised', 'synchroniser', 'synchronisers', 'synchronises', 'synchronising', 'systematisable', 'systematisation', 'systematisations', 'systematise', 'systematised', 'systematiser', 'systematisers',
  'systematises', 'systematising', 'tantalisable', 'tantalisation', 'tantalisations', 'tantalise', 'tantalised', 'tantaliser', 'tantalisers', 'tantalises', 'tantalising', 'temporisable', 'temporisation', 'temporisations',
  'temporise', 'temporised', 'temporiser', 'temporisers', 'temporises', 'temporising', 'tenderisable', 'tenderisation', 'tenderisations', 'tenderise', 'tenderised', 'tenderiser', 'tenderisers', 'tenderises',
  'tenderising', 'terrorisable', 'terrorisation', 'terrorisations', 'terrorise', 'terrorised', 'terroriser', 'terrorisers', 'terrorises', 'terrorising', 'theatre', 'theatres', 'theorisable', 'theorisation',
  'theorisations', 'theorise', 'theorised', 'theoriser', 'theorisers', 'theorises', 'theorising', 'titbit', 'titbits', 'totalled', 'tranquillisable', 'tranquillisation', 'tranquillisations', 'tranquillise',
  'tranquillised', 'tranquilliser', 'tranquillisers', 'tranquillises', 'tranquillising', 'traumatisable', 'traumatisation', 'traumatisations', 'traumatise', 'traumatised', 'traumatiser', 'traumatisers', 'traumatises', 'traumatising',
  'travelled', 'traveller', 'travellers', 'travelling', 'trivialisable', 'trivialisation', 'trivialisations', 'trivialise', 'trivialised', 'trivialiser', 'trivialisers', 'trivialises', 'trivialising', 'tumour',
  'tumours', 'tunnelled', 'tyrannisable', 'tyrannisation', 'tyrannisations', 'tyrannise', 'tyrannised', 'tyranniser', 'tyrannisers', 'tyrannises', 'tyrannising', 'tyre', 'tyres', 'unfavourable',
  'unionisable', 'unionisation', 'unionisations', 'unionise', 'unionised', 'unioniser', 'unionisers', 'unionises', 'unionising', 'unravelled', 'unravelling', 'urbanisable', 'urbanisation', 'urbanisations',
  'urbanise', 'urbanised', 'urbaniser', 'urbanisers', 'urbanises', 'urbanising', 'utilisable', 'utilisation', 'utilisations', 'utilise', 'utilised', 'utiliser', 'utilisers', 'utilises',
  'utilising', 'valour', 'vandalisable', 'vandalisation', 'vandalisations', 'vandalise', 'vandalised', 'vandaliser', 'vandalisers', 'vandalises', 'vandalising', 'vaporisable', 'vaporisation', 'vaporisations',
  'vaporise', 'vaporised', 'vaporiser', 'vaporisers', 'vaporises', 'vaporising', 'vapour', 'vapours', 'verbalisable', 'verbalisation', 'verbalisations', 'verbalise', 'verbalised', 'verbaliser',
  'verbalisers', 'verbalises', 'verbalising', 'victimisable', 'victimisation', 'victimisations', 'victimise', 'victimised', 'victimiser', 'victimisers', 'victimises', 'victimising', 'vigour', 'visualisable',
  'visualisation', 'visualisations', 'visualise', 'visualised', 'visualiser', 'visualisers', 'visualises', 'visualising', 'vocalisable', 'vocalisation', 'vocalisations', 'vocalise', 'vocalised', 'vocaliser',
  'vocalisers', 'vocalises', 'vocalising', 'vulgarisable', 'vulgarisation', 'vulgarisations', 'vulgarise', 'vulgarised', 'vulgariser', 'vulgarisers', 'vulgarises', 'vulgarising', 'watercolour', 'watercolours',
  'weaponisable', 'weaponisation', 'weaponisations', 'weaponise', 'weaponised', 'weaponiser', 'weaponisers', 'weaponises', 'weaponising', 'westernisable', 'westernisation', 'westernisations', 'westernise', 'westernised',
  'westerniser', 'westernisers', 'westernises', 'westernising', 'whilst', 'wilful', 'winterisable', 'winterisation', 'winterisations', 'winterise', 'winterised', 'winteriser', 'winterisers', 'winterises',
  'winterising', 'womanisable', 'womanisation', 'womanisations', 'womanise', 'womanised', 'womaniser', 'womanisers', 'womanises', 'womanising', 'woollen', 'yoghurt',
];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const PATTERN = new RegExp('\\b(' + WORDS.map((w) => `${w}|${cap(w)}|${w.toUpperCase()}`).join('|') + ')\\b', 'g');
const STR = /(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g;
const JSX_TEXT = />([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '.next') yield* walk(p); }
    else if (/\.(tsx?|mjs|json)$/.test(name) && !/\.test\.tsx?$/.test(name) && !SKIP.test(name)) yield p;
  }
}
/** The player-readable parts of a file: everything in JSON (values only, answers and keys excluded), comments + strings + JSX text in code. */
function readable(file: string, text: string): string[] {
  if (file.endsWith('.json')) {
    const out: string[] = [];
    const visit = (v: unknown, key: string) => {
      if (Array.isArray(v)) v.forEach((x) => visit(x, key));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, k);
      else if (typeof v === 'string' && !['theme', 'answer', 'id', 'key', 'cartoon', 'holiday', 'words', 'w', 'final', 'display', 'wikiTitle'].includes(key) && !/^[A-Z]{2,}$/.test(v)) out.push(v);
    };
    try { visit(JSON.parse(text), ''); } catch { return [text]; }
    return out;
  }
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const t = line.trimStart();
    if (/^(\/\/|\/\*|\*)/.test(t)) { out.push(line); continue; }
    for (const m of line.match(STR) || []) out.push(m);
    if (file.endsWith('.tsx')) for (const m of line.match(JSX_TEXT) || []) out.push(m);
    const i = line.indexOf(' // '); if (i > 0) out.push(line.slice(i));
  }
  return out;
}

describe('American spelling in player-facing copy', () => {
  it('has no British spellings in app copy, components, banks, dictionary or the catalog', () => {
    const hits: string[] = [];
    for (const file of [...DIRS.flatMap((d) => [...walk(d)]), CATALOG]) {
      const text = readFileSync(file, 'utf8');
      for (const chunk of readable(file, text)) { const m = chunk.match(PATTERN)?.filter((w) => !ALLOW.some(([f, word]) => file.endsWith(f) && w === word)); if (m?.length) hits.push(`${relative(ROOT, file)}: ${[...new Set(m)].join(', ')} — ${chunk.slice(0, 80)}`); }
    }
    expect(hits, `British spelling found (${hits.length}):\n${hits.slice(0, 25).join('\n')}`).toEqual([]);
  });
});
