import type { Library } from './types'

export function createSeed(): Library {
  const topics = [
    { id: 't1', subjectId: 's1', name: 'Concordância verbal' },
    { id: 't2', subjectId: 's1', name: 'Crase' },
    { id: 't3', subjectId: 's1', name: 'Figuras de linguagem' },
    { id: 't4', subjectId: 's2', name: 'Revolução Francesa' },
    { id: 't5', subjectId: 's2', name: 'Brasil Colônia' },
    { id: 't6', subjectId: 's3', name: 'Álgebra' },
    { id: 't7', subjectId: 's3', name: 'Geometria' },
    { id: 't8', subjectId: 's4', name: 'Biologia celular' },
    { id: 't9', subjectId: 's4', name: 'Ecologia' },
  ]
  const entries = [
    [
      't1',
      'O que é concordância verbal?',
      'É a relação entre o verbo e o sujeito: o verbo concorda com o sujeito em número e pessoa.\n\nExemplo: “Os alunos estudam todos os dias.”',
    ],
    [
      't1',
      '“Faz” ou “fazem” dois anos?',
      'Faz dois anos.\n\nO verbo fazer, quando indica tempo decorrido, é impessoal e fica na terceira pessoa do singular.',
    ],
    [
      't1',
      'Como o verbo “haver” concorda no sentido de existir?',
      'Fica no singular, pois é impessoal.\n\nExemplo: “Havia muitos livros na biblioteca.”',
    ],
    [
      't1',
      '“A maioria dos alunos chegou” está correto?',
      'Sim. Com expressões partitivas, o verbo pode concordar com o núcleo ou com o especificador.\n\n“A maioria dos alunos chegou” e “A maioria dos alunos chegaram” são possíveis.',
    ],
    [
      't2',
      'O que é crase?',
      'É a fusão de duas vogais “a”, geralmente a preposição “a” com o artigo feminino “a”. É indicada pelo acento grave: à.',
    ],
    [
      't2',
      'Há crase antes de verbos?',
      'Não. Não se usa o artigo feminino antes de verbos.\n\nExemplo: “Começou a estudar.”',
    ],
    [
      't2',
      'Qual é um teste útil para verificar a crase?',
      'Troque o termo feminino por um masculino equivalente. Se aparecer “ao”, em geral há crase.\n\n“Vou à escola” → “Vou ao colégio”.',
    ],
    [
      't3',
      'Qual a diferença entre metáfora e comparação?',
      'A metáfora associa elementos sem um conectivo explícito: “A vida é um rio”.\n\nA comparação usa conectivos: “A vida é como um rio”.',
    ],
    [
      't3',
      'O que é uma hipérbole?',
      'É uma expressão exagerada usada para dar ênfase.\n\nExemplo: “Já te falei mil vezes!”',
    ],
    [
      't4',
      'Em que ano começou a Revolução Francesa?',
      'Em 1789. A tomada da Bastilha, em 14 de julho, tornou-se um de seus principais marcos.',
    ],
    ['t4', 'Qual era o lema da Revolução Francesa?', 'Liberdade, igualdade e fraternidade.'],
    [
      't4',
      'Quais eram os três estados da sociedade francesa?',
      'Primeiro Estado: clero.\nSegundo Estado: nobreza.\nTerceiro Estado: os demais grupos sociais, incluindo a burguesia e os trabalhadores.',
    ],
    [
      't5',
      'O que eram as capitanias hereditárias?',
      'Grandes faixas de terra concedidas pela Coroa portuguesa a donatários para administrar e colonizar o território. O sistema foi implantado em 1534.',
    ],
    [
      't5',
      'Qual foi a primeira capital do Brasil?',
      'Salvador, fundada em 1549. A capital foi transferida para o Rio de Janeiro em 1763.',
    ],
    [
      't6',
      'Qual é a fórmula de Bhaskara?',
      'Para ax² + bx + c = 0, com a ≠ 0:\n\nx = (−b ± √Δ) / 2a\nΔ = b² − 4ac',
    ],
    [
      't6',
      'O que é uma equação de primeiro grau?',
      'É uma equação em que a incógnita tem expoente máximo igual a 1.\n\nExemplo: 2x + 4 = 10 → x = 3.',
    ],
    [
      't7',
      'Como calcular a área de um triângulo?',
      'Área = (base × altura) / 2.\n\nA altura é a distância perpendicular entre a base e o vértice oposto.',
    ],
    [
      't7',
      'O que diz o teorema de Pitágoras?',
      'Em um triângulo retângulo, o quadrado da hipotenusa é igual à soma dos quadrados dos catetos.\n\na² = b² + c²',
    ],
    [
      't8',
      'Qual é a função das mitocôndrias?',
      'São responsáveis por grande parte da produção de ATP na respiração celular, fornecendo energia para as atividades da célula.',
    ],
    [
      't8',
      'Qual a diferença entre células procariontes e eucariontes?',
      'Procariontes não possuem núcleo delimitado por membrana.\n\nEucariontes possuem núcleo delimitado e organelas membranosas.',
    ],
    [
      't8',
      'Qual é a função dos ribossomos?',
      'Produzir proteínas, traduzindo as informações do RNA mensageiro.',
    ],
    [
      't9',
      'O que é uma cadeia alimentar?',
      'É a sequência de transferência de matéria e energia entre seres vivos por meio da alimentação.',
    ],
    [
      't9',
      'Qual a diferença entre habitat e nicho ecológico?',
      'Habitat é o local onde uma espécie vive.\n\nNicho ecológico é o conjunto de suas relações e funções no ecossistema.',
    ],
  ]
  return {
    version: 1,
    subjects: [
      { id: 's1', name: 'Português', color: 'sage', icon: 'book' },
      { id: 's2', name: 'História', color: 'peach', icon: 'landmark' },
      { id: 's3', name: 'Matemática', color: 'blue', icon: 'calculator' },
      { id: 's4', name: 'Biologia', color: 'lilac', icon: 'leaf' },
    ],
    topics,
    cards: entries.map(([topicId, question, answer], index) => ({
      id: `demo-${index}`,
      topicId,
      question,
      answer,
      favorite: [0, 5, 9, 14].includes(index),
      createdAt: new Date().toISOString(),
      dueAt: new Date().toISOString(),
      reviews: 0,
    })),
    history: [],
  }
}
