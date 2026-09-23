-- 004_catalogo_referencia.sql
-- Catálogo e opções prontas a partir dos cardápios de referência (public/ref: Brunch, Buffet,
-- Comida de Boteco e Empratado) para o tenant de demonstração "banket".
-- Substitui o catálogo de exemplo anterior desse tenant.
--
-- Itens: string (só nome) ou objeto { n: nome, d: descrição, r: restrições, o: dados operacionais, p: preço, u: unidade }.
-- Restrições: vegetariana, vegana, sem_gluten, sem_lactose, alergenicos.
-- Dados operacionais: preparo_evento, frito, assado, cozido, consumo_2h.

DO $seed$
DECLARE
    v_tenant UUID;
    dados JSONB := $json$
{
  "secoes": [
    { "nome": "Mesa de pães", "principal": "Salgado", "secundaria": "Recepção", "itens": [
      { "n": "Pão de fermentação natural", "r": ["vegetariana", "vegana", "sem_lactose"] },
      { "n": "Croissant", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Focaccia", "r": ["vegetariana", "vegana", "sem_lactose"], "o": ["assado"] } ] },
    { "nome": "Queijos e embutidos", "principal": "Salgado", "secundaria": "Recepção", "itens": [
      { "n": "Salame italiano", "r": ["sem_gluten"] },
      { "n": "Parmesão", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Gorgonzola", "r": ["vegetariana", "sem_gluten"] } ] },
    { "nome": "Sanduíches", "principal": "Salgado", "secundaria": "Recepção", "itens": [
      { "n": "Croissant com copa", "d": "Croissant, copa, parmesão, alface, tomate e molho rosé" },
      { "n": "Focaccia caprese", "d": "Focaccia, muçarela de búfala, tomate, rúcula e pesto", "r": ["vegetariana"] } ] },
    { "nome": "Antepastos", "principal": "Salgado", "secundaria": "Entrada", "itens": [
      { "n": "Burrata", "d": "Burrata acompanhada de tomates frescos e pesto de manjericão", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Brie assado", "d": "Brie assado com castanhas, nozes e mel", "r": ["vegetariana", "alergenicos"], "o": ["assado"] },
      { "n": "Brie assado com massa folhada", "d": "Brie assado com massa folhada, nozes, castanhas e mel", "r": ["vegetariana", "alergenicos"], "o": ["assado"] },
      { "n": "Abobrinha grelhada", "d": "Abobrinha grelhada com alho e azeite de oliva extravirgem", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Caponata siciliana", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Roast beef", "d": "Roast beef com molho de mostarda e alcaparras", "r": ["sem_gluten", "sem_lactose"] },
      { "n": "Tomate cereja confitado", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Mix de azeitonas", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Batatas confitadas", "d": "Batatas confitadas com alho, pimenta dedo-de-moça e alecrim", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Batata bolinha confitada", "d": "Batata bolinha confitada no azeite de oliva", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Cebola em conserva", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Pasta de tomate seco", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Pasta de ervas", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Damasco", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Castanhas variadas", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose", "alergenicos"] } ] },
    { "nome": "Quiches, tortas e massas do brunch", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Quiche de cogumelos frescos", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Torta de camarão, palmito e queijo cremoso", "r": ["alergenicos"], "o": ["assado"] },
      { "n": "Torta de frango com queijo cremoso", "o": ["assado"] },
      { "n": "Talharim grano duro fresco", "d": "Molho de tomate rústico e manjericão | Molho Alfredo", "r": ["vegetariana"], "o": ["preparo_evento", "cozido"] } ] },
    { "nome": "Frutas, caldas e geleias", "principal": "Doce", "secundaria": "Sobremesa", "itens": [
      { "n": "Calda de frutas vermelhas", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Geleia de laranja", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Mel de jataí", "r": ["vegetariana", "sem_gluten", "sem_lactose"] },
      { "n": "Uvas sem semente", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Morangos", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] } ] },
    { "nome": "Bolos e doces do brunch", "principal": "Doce", "secundaria": "Sobremesa", "itens": [
      { "n": "Bolo de cenoura com cobertura de chocolate", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Bolo de fubá", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Cheesecake com calda de frutas vermelhas", "r": ["vegetariana"] },
      { "n": "Pain perdu", "d": "Brioche curtido no creme de baunilha e grelhado na manteiga", "r": ["vegetariana"], "o": ["preparo_evento", "consumo_2h"] } ] },
    { "nome": "Coquetel", "principal": "Salgado", "secundaria": "Recepção", "formato": "Serviço volante", "itens": [
      { "n": "Bruschetta de tomate, manjericão e parmesão", "r": ["vegetariana"] },
      { "n": "Bruschetta de abobrinha e alho", "r": ["vegetariana", "vegana", "sem_lactose"] },
      { "n": "Bruschetta de queijos", "r": ["vegetariana"] },
      { "n": "Empanada de cebola assada", "d": "Empanada de cebola assada com queijo asiago, servida com chimichurri", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Dadinho de tapioca", "d": "Dadinho de tapioca com geleia de maçã e pimenta", "r": ["vegetariana", "sem_gluten"], "o": ["frito", "preparo_evento", "consumo_2h"] },
      { "n": "Polenta cremosa com ragú de linguiça", "r": ["sem_gluten"], "o": ["preparo_evento"] },
      { "n": "Steak tartar", "d": "Mignon cortado na faca, com temperos e especiarias, servido com torradas", "o": ["consumo_2h"] } ] },
    { "nome": "Comida de boteco", "principal": "Salgado", "secundaria": "Recepção", "itens": [
      { "n": "Carne de onça", "o": ["consumo_2h"] },
      { "n": "Aipim frito com bacon", "r": ["sem_gluten", "sem_lactose"], "o": ["frito", "preparo_evento"] },
      { "n": "Calabresa acebolada", "d": "Servida com torradas de fermentação natural e farofa de alho", "o": ["preparo_evento"] },
      { "n": "Empanada de cebola com queijo asiago", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Dadinho de tapioca com geleia de pimenta", "r": ["vegetariana", "sem_gluten"], "o": ["frito", "preparo_evento"] },
      { "n": "Pão com bolinho de carne", "d": "Pão com bolinho de carne, queijo, maionese da casa e mostarda escura", "o": ["frito"] },
      { "n": "Sanduíche de roastbeef", "d": "Sanduíche de roastbeef com vinagrete e mostarda amarela" } ] },
    { "nome": "Saladas", "principal": "Salgado", "secundaria": "Entrada", "itens": [
      { "n": "Salada Caesar", "d": "Alface americana, rúcula e radicchio roxo com molho Caesar", "r": ["vegetariana"] },
      { "n": "Salada de rúcula, morango e manga", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Salada mediterrânea", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Salada de couscous", "r": ["vegetariana", "vegana", "sem_lactose"] },
      { "n": "Salada de folhas verdes, tomate cereja, gorgonzola e redução de aceto", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Salada caprese", "d": "Tomate cereja, muçarela de búfala, pesto de manjericão e rúcula", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Salada de folhas verdes, nozes, melão e presunto cru", "r": ["sem_gluten", "alergenicos"] } ] },
    { "nome": "Acompanhamentos", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Arroz branco", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"], "o": ["cozido"] },
      { "n": "Arroz com amêndoas", "r": ["vegetariana", "sem_gluten", "alergenicos"], "o": ["cozido"] },
      { "n": "Arroz à grega", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"], "o": ["cozido"] },
      { "n": "Legumes grelhados", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Batata rústica", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"], "o": ["assado"] },
      { "n": "Batata sauté", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Risoto funghi", "r": ["vegetariana", "sem_gluten"], "o": ["preparo_evento", "consumo_2h"] },
      { "n": "Risoto de gorgonzola, nozes e pêra", "r": ["vegetariana", "sem_gluten", "alergenicos"], "o": ["preparo_evento", "consumo_2h"] },
      { "n": "Risoto milanês", "r": ["vegetariana", "sem_gluten"], "o": ["preparo_evento", "consumo_2h"] } ] },
    { "nome": "Massas", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Penne", "r": ["vegetariana", "vegana", "sem_lactose"], "o": ["cozido", "preparo_evento"] },
      { "n": "Tagliarini", "r": ["vegetariana"], "o": ["cozido", "preparo_evento"] },
      { "n": "Pappardelle", "r": ["vegetariana"], "o": ["cozido", "preparo_evento"] } ] },
    { "nome": "Molhos", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Molho branco", "r": ["vegetariana"] },
      { "n": "Pomodoro e basílico", "r": ["vegetariana", "vegana", "sem_gluten", "sem_lactose"] },
      { "n": "Bolonhesa", "r": ["sem_gluten", "sem_lactose"] },
      { "n": "Alfredo", "r": ["vegetariana"] },
      { "n": "Ragú de linguiça", "r": ["sem_gluten", "sem_lactose"] },
      { "n": "Ragú de fraldinha", "r": ["sem_gluten", "sem_lactose"] },
      { "n": "Funghi", "r": ["vegetariana"] } ] },
    { "nome": "Massas recheadas", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Mix de queijos com molho de tomate e manjericão", "r": ["vegetariana"] },
      { "n": "Queijo com molho de tomate", "r": ["vegetariana"] },
      { "n": "Gorgonzola e nozes com molho de pêra", "r": ["vegetariana", "alergenicos"] },
      { "n": "Linguiça com molho de queijo" },
      { "n": "Camarão com molho de limão siciliano", "r": ["alergenicos"] } ] },
    { "nome": "Massas de travessa", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Lasanha bolonhesa", "o": ["assado"] },
      { "n": "Lasanha de queijo", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Lasanha de queijo e presunto", "o": ["assado"] },
      { "n": "Rondelli de queijo e presunto", "o": ["assado"] },
      { "n": "Rondelli de ricota com espinafre", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Rondelli de rúcula com tomate seco", "r": ["vegetariana"], "o": ["assado"] },
      { "n": "Conchiglione com camarão e requeijão cremoso", "r": ["alergenicos"], "o": ["assado"] },
      { "n": "Conchiglione com figo ao molho branco", "r": ["vegetariana"], "o": ["assado"] } ] },
    { "nome": "Frango e porco", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Sobrecoxa de frango assada", "r": ["sem_gluten", "sem_lactose"], "o": ["assado"] },
      { "n": "Frango xadrez", "r": ["sem_lactose", "alergenicos"] },
      { "n": "Peito de frango recheado com queijo e bacon", "o": ["assado"] },
      { "n": "Peito de frango grelhado", "r": ["sem_gluten", "sem_lactose"] },
      { "n": "Estrogonofe de frango", "r": ["sem_gluten"] },
      { "n": "Copa grelhada ao molho de limão", "r": ["sem_gluten"] },
      { "n": "Lombo suíno assado com laranja-pera", "r": ["sem_gluten", "sem_lactose"], "o": ["assado"] },
      { "n": "Lombo suíno assado com molho de damasco e bacon", "r": ["sem_gluten", "sem_lactose"], "o": ["assado"] },
      { "n": "Costelinha de porco com molho barbecue", "r": ["sem_lactose"], "o": ["assado"] } ] },
    { "nome": "Peixes", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Peixe branco com manteiga de alcaparras", "r": ["sem_gluten", "alergenicos"] },
      { "n": "Tilápia grelhada com crosta de tomate", "r": ["alergenicos"] },
      { "n": "Tilápia grelhada à Belle Meunière", "r": ["alergenicos"] },
      { "n": "Pirarucu marinado com raspas de limão e gengibre", "d": "Assado no vapor", "r": ["sem_gluten", "sem_lactose", "alergenicos"] },
      { "n": "Pirarucu com crosta de castanhas e limão caipira", "r": ["sem_lactose", "alergenicos"], "o": ["assado"] } ] },
    { "nome": "Carnes vermelhas", "principal": "Salgado", "secundaria": "Prato principal", "itens": [
      { "n": "Alcatra grelhada com molho de cogumelos frescos", "r": ["sem_gluten"] },
      { "n": "Fraldinha marinada na mostarda", "r": ["sem_gluten", "sem_lactose"], "o": ["assado"] },
      { "n": "Bife de chorizo com chimichurri", "r": ["sem_gluten", "sem_lactose"], "o": ["preparo_evento"] },
      { "n": "Entrecôte ao molho madeira" },
      { "n": "Estrogonofe de carne", "r": ["sem_gluten"] } ] },
    { "nome": "Sobremesas", "principal": "Doce", "secundaria": "Sobremesa", "itens": [
      { "n": "Cheesecake", "r": ["vegetariana"] },
      { "n": "Banoffee", "r": ["vegetariana"] },
      { "n": "Mousse de limão com merengue italiano", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Mousse de maracujá", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Mousse de maracujá com Oreo", "r": ["vegetariana"] },
      { "n": "Pudim de leite", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Brownie de chocolate", "r": ["vegetariana", "alergenicos"], "o": ["assado"] },
      { "n": "Tiramissu", "r": ["vegetariana"] },
      { "n": "Pavlova", "d": "Pavlova recheada com creme de baunilha e calda de frutas vermelhas", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Brigadeiro de colher", "r": ["vegetariana", "sem_gluten"] } ] },
    { "nome": "Entradas empratadas", "principal": "Salgado", "secundaria": "Entrada", "formato": "Empratado", "itens": [
      { "n": "Salada de folhas verdes, presunto cru, gorgonzola e nozes", "d": "Alface frisée e rúcula com fatias de presunto cru, gorgonzola, nozes caramelizadas com maple syrup e vinagrete de tangerina", "r": ["sem_gluten", "alergenicos"] },
      { "n": "Salada Caprese Casa Club", "d": "Tomate italiano assado com azeite, ervas frescas e alho, recheado com mozzarella de búfala, rúcula e pesto de manjericão", "r": ["vegetariana", "sem_gluten"], "o": ["assado"] },
      { "n": "Steak tartar empratado", "d": "Mignon cortado na faca, com temperos e especiarias, servido com torradas de pão italiano de fermentação natural", "o": ["consumo_2h"] },
      { "n": "Polenta branca cremosa com cogumelos frescos", "d": "Polenta branca cozida em caldo de legumes com cogumelos paris, shitake e shimeji grelhados e flambados com cachaça amarela", "r": ["vegetariana", "sem_gluten"], "o": ["preparo_evento"] },
      { "n": "Salada de folhas verdes, gravlax de salmão e maçã verde", "d": "Folhas verdes com lâminas de salmão curado na casa com dill e maçãs verdes glaceadas com mel de laranjeira e alecrim", "r": ["sem_gluten", "sem_lactose", "alergenicos"] },
      { "n": "Crabcake", "d": "Croqueta de siri servida com molho de mamão e pimenta verde", "r": ["alergenicos"], "o": ["frito", "preparo_evento"] },
      { "n": "Lula recheada", "d": "Lula recheada com camarões e especiarias, cozida no caldo de legumes, com tartar de tomate ao molho de leite de coco e pimentão", "r": ["sem_gluten", "sem_lactose", "alergenicos"], "o": ["cozido"] },
      { "n": "Codorna grelhada", "d": "Codorna grelhada acompanhada de repolho roxo e mel de jataí", "r": ["sem_gluten", "sem_lactose"], "o": ["preparo_evento"] },
      { "n": "Polvo grelhado", "d": "Polvo grelhado finalizado com manteiga de ervas e batatas ao murro com alecrim e alho", "r": ["sem_gluten", "alergenicos"], "o": ["preparo_evento"] },
      { "n": "Roastbeef de peito de pato", "d": "Peito de pato marinado com chá de jasmim, grelhado e fatiado, com cebolas caramelizadas, alho assado e torradas" } ] },
    { "nome": "Pratos principais empratados", "principal": "Salgado", "secundaria": "Prato principal", "formato": "Empratado", "itens": [
      { "n": "Risoto de pêra, nozes e gorgonzola", "d": "Risoto com pêras confitadas, nozes tostadas e queijo gorgonzola", "r": ["vegetariana", "sem_gluten", "alergenicos"], "o": ["preparo_evento"] },
      { "n": "Peixe branco com legumes confitados", "d": "Peixe branco marinado com ervas e grelhado, com legumes confitados no azeite, ervas frescas e vinho branco", "r": ["sem_gluten", "sem_lactose", "alergenicos"] },
      { "n": "Bife de chorizo com batatas rústicas, vinagrete e farofa", "d": "Bife de chorizo Angus grelhado ao chimichurri, batatas assadas com alecrim, vinagrete da casa e farofa de alho", "r": ["sem_lactose"], "o": ["preparo_evento"] },
      { "n": "Paleta de cordeiro assada com talharim artesanal", "d": "Paleta de cordeiro marinada e assada lentamente, desossada, com talharim grano duro na manteiga de alho assado", "o": ["assado"] },
      { "n": "Paleta de cordeiro ao molho de cerveja preta", "d": "Paleta de cordeiro assada lentamente ao molho de cerveja preta, com talharim artesanal na manteiga de alho assado", "o": ["assado"] },
      { "n": "Miolo de alcatra com risoto de cogumelos", "d": "Miolo de alcatra grelhado com risoto de cogumelos paris, shitake e shimeji, parmesão argentino e molho de vinho Malbec", "r": ["sem_gluten"], "o": ["preparo_evento"] },
      { "n": "Entrecôte grelhado com linguini, tomates e cogumelos", "d": "Entrecôte grelhado com linguini da casa ao molho de cogumelos frescos e tomates italianos", "o": ["preparo_evento"] },
      { "n": "Ravióli com cebola assada e queijo gruyère", "d": "Ravióli de semolina recheado com cebola roxa assada e gruyère, ao molho rústico de tomate italiano e manjericão", "r": ["vegetariana"] },
      { "n": "Ravióli com camarão", "d": "Ravióli feito na casa recheado com camarões e especiarias, com molho de limão siciliano e crocante de bacon", "r": ["alergenicos"] },
      { "n": "Linguini com lascas de bacalhau e tapenade", "d": "Linguini grano duro com bacalhau confitado, tomate italiano, alho assado, manjericão e molho de azeitonas pretas", "r": ["sem_lactose", "alergenicos"] },
      { "n": "Ravióli de queijo de cabra", "d": "Ravióli recheado com queijo de cabra ao molho rústico de linguiça artesanal, tomates frescos e erva-doce" },
      { "n": "Mignon com risoto de cogumelos ao molho de vinho tinto", "d": "Tournedo de mignon grelhado com risoto de cogumelos, parmesão argentino e molho de vinho Malbec", "r": ["sem_gluten"], "o": ["preparo_evento"] },
      { "n": "Mignon com linguini, tomates frescos e cogumelos", "d": "Tournedo de mignon grelhado com linguini da casa ao molho de cogumelos frescos e tomates italianos", "o": ["preparo_evento"] },
      { "n": "Paella valenciana", "d": "Tradicional prato espanhol com arroz bomba, frutos do mar e açafrão", "r": ["sem_gluten", "sem_lactose", "alergenicos"], "o": ["preparo_evento"] },
      { "n": "Bacalhau confitado", "d": "Bacalhau Gadus Morhua confitado no azeite, com pimentões e cebolas grelhadas, alho assado e batatas ao murro", "r": ["sem_gluten", "sem_lactose", "alergenicos"] },
      { "n": "Pirarucu com crosta de castanhas brasileiras", "d": "Pirarucu marinado com crosta de castanhas, verduras no vapor de vinho branco e molho de limão", "r": ["sem_lactose", "alergenicos"] },
      { "n": "Confit de pato", "d": "Coxa e sobrecoxa de pato confitadas, com risoto de pêra cozida no vinho tinto e raspas de laranja ao molho de uva", "r": ["sem_gluten"] },
      { "n": "Peito de pato", "d": "Peito de pato grelhado com tomate holandês recheado com frutas vermelhas e mel trufado", "r": ["sem_gluten", "sem_lactose"] },
      { "n": "Carré de cordeiro", "d": "Carré de cordeiro com crosta de pistache e maçã recheada com nozes, castanhas, hortelã e mel ao molho cítrico", "r": ["sem_gluten", "alergenicos"] },
      { "n": "Costela bovina defumada", "d": "Costela bovina defumada por 12 horas com mousseline de batata-baroa", "r": ["sem_gluten"] } ] },
    { "nome": "Sobremesas empratadas", "principal": "Doce", "secundaria": "Sobremesa", "formato": "Empratado", "itens": [
      { "n": "Mil-folhas com creme de chocolate", "d": "Massa folhada recheada com creme de chocolate e morangos frescos", "r": ["vegetariana"] },
      { "n": "Mil-folhas com creme de cupuaçu e chocolate", "d": "Massa folhada recheada com creme de cupuaçu, chocolate e morangos frescos", "r": ["vegetariana"] },
      { "n": "Brownie de chocolate belga", "d": "Brownie de chocolate belga e nozes com calda quente de chocolate e doce de leite", "r": ["vegetariana", "alergenicos"] },
      { "n": "Cheesecake com frutas vermelhas", "d": "Torta gelada de queijo com calda de framboesa, morangos, mirtilo e amora", "r": ["vegetariana"] },
      { "n": "Pavlova empratada", "d": "Suspiro recheado com creme de baunilha e calda de frutas vermelhas", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Queijos e geleias", "d": "Queijos nacionais com geleias de maçã verde, abacaxi e damasco", "r": ["vegetariana", "sem_gluten"] },
      { "n": "Queijo coalho grelhado", "d": "Queijo coalho grelhado servido com sorvete de goiabada", "r": ["vegetariana", "sem_gluten"], "o": ["preparo_evento"] },
      { "n": "Tiramissú", "d": "Torta gelada de café com creme de mascarpone", "r": ["vegetariana"] },
      { "n": "Duo de crème brûlée", "d": "Crème brûlée de chocolate belga e crème brûlée de tangerina", "r": ["vegetariana", "sem_gluten"] } ] },
    { "nome": "Soft drinks", "principal": "Bebida", "descricao": "Pacote de bebidas sem álcool servido durante todo o evento", "preco": 20, "unidade": "pessoa", "itens": [
      "Água sem gás", "Água com gás", "Coca-Cola", "Coca-Cola Zero", "Guaraná Antarctica", "Guaraná Antarctica Zero", "Suco de laranja" ] },
    { "nome": "Estação de open drinks", "principal": "Bebida", "descricao": "Drinks servidos durante 2h30. Gin, cachaça e vodka; frutas e especiarias; tônica, xaropes e espuma de gengibre", "preco": 70, "unidade": "pessoa", "itens": [
      "Gin & tônica", "Moscow Mule", "Caipirinha | Caipirosca" ] },
    { "nome": "Chope e cerveja", "principal": "Bebida", "descricao": "Serviço de chope tem taxa de R$ 150,00 (recebimento, devolução e energia)", "itens": [
      { "n": "Chope artesanal Klein – barril 30 litros", "p": 600, "u": "unidade" },
      { "n": "Chope artesanal Klein – barril 50 litros", "p": 900, "u": "unidade" },
      { "n": "Cerveja long neck Heineken", "p": 15, "u": "unidade" } ] },
    { "nome": "Vinhos e destilados", "principal": "Bebida", "descricao": "Rolha para vinho/espumante trazido pelo cliente: R$ 35,00", "itens": [
      { "n": "Vinho (a partir de)", "p": 115, "u": "unidade" },
      { "n": "Espumante (a partir de)", "p": 115, "u": "unidade" },
      { "n": "Whisky Johnnie Walker Black Label", "p": 250, "u": "unidade" },
      { "n": "Bourbon Jack Daniel's", "p": 220, "u": "unidade" } ] }
  ],
  "opcoes": [
    { "nome": "Brunch", "preco": 250, "duracao": 2, "formato": "Buffet", "tags": ["Brunch", "Buffet"],
      "descricao": "Mesa farta de pães, antepastos, quiches, bolos e frutas",
      "secoes": [
        { "secao": "Mesa de pães", "itens": ["Pão de fermentação natural", "Croissant", "Focaccia"] },
        { "secao": "Queijos e embutidos", "itens": ["Salame italiano", "Parmesão"] },
        { "secao": "Sanduíches", "itens": ["Croissant com copa", "Focaccia caprese"] },
        { "secao": "Antepastos", "titulo": "Mesa de pastas, saladas e antepastos", "itens": ["Burrata", "Brie assado", "Abobrinha grelhada", "Caponata siciliana", "Roast beef"] },
        { "secao": "Saladas", "itens": ["Salada Caesar"] },
        { "secao": "Quiches, tortas e massas do brunch", "titulo": "Quiches, tortas e massas", "itens": ["Quiche de cogumelos frescos", "Torta de camarão, palmito e queijo cremoso", "Torta de frango com queijo cremoso", "Talharim grano duro fresco"] },
        { "secao": "Frutas, caldas e geleias", "itens": ["Calda de frutas vermelhas", "Geleia de laranja", "Mel de jataí", "Uvas sem semente", "Morangos"] },
        { "secao": "Bolos e doces do brunch", "titulo": "Bolos e doces", "itens": ["Bolo de cenoura com cobertura de chocolate", "Bolo de fubá", "Cheesecake com calda de frutas vermelhas", "Pain perdu"] } ] },
    { "nome": "Comida de boteco", "preco": 110, "duracao": 2, "formato": "Serviço volante", "tags": ["Boteco", "Informal"],
      "secoes": [
        { "secao": "Comida de boteco", "itens": ["Carne de onça", "Aipim frito com bacon", "Calabresa acebolada", "Empanada de cebola com queijo asiago", "Dadinho de tapioca com geleia de pimenta", "Pão com bolinho de carne", "Sanduíche de roastbeef"] },
        { "secao": "Sobremesas", "itens": ["Pudim de leite", "Brigadeiro de colher"] } ] },
    { "nome": "Coquetel recepção – Opção 01", "preco": 25, "formato": "Serviço volante", "tags": ["Coquetel", "Casamento"],
      "secoes": [ { "secao": "Coquetel", "itens": ["Bruschetta de tomate, manjericão e parmesão", "Bruschetta de abobrinha e alho", "Bruschetta de queijos"] } ] },
    { "nome": "Coquetel recepção – Opção 02", "preco": 40, "formato": "Serviço volante", "tags": ["Coquetel", "Casamento"],
      "secoes": [ { "secao": "Coquetel", "itens": ["Bruschetta de tomate, manjericão e parmesão", "Empanada de cebola assada", "Dadinho de tapioca", "Polenta cremosa com ragú de linguiça"] } ] },
    { "nome": "Coquetel recepção – Opção 03", "preco": 55, "formato": "Serviço volante", "tags": ["Coquetel", "Casamento"],
      "secoes": [ { "secao": "Coquetel", "itens": ["Bruschetta de tomate, manjericão e parmesão", "Empanada de cebola assada", "Dadinho de tapioca", "Steak tartar", "Polenta cremosa com ragú de linguiça"] } ] },
    { "nome": "Mesa de antepastos – Opção 01", "preco": 65, "formato": "Ilhas gastronômicas", "tags": ["Antepastos", "Recepção"],
      "secoes": [
        { "secao": "Mesa de pães", "itens": ["Pão de fermentação natural", "Focaccia"] },
        { "secao": "Queijos e embutidos", "itens": ["Salame italiano", "Parmesão"] },
        { "secao": "Antepastos", "itens": ["Abobrinha grelhada", "Caponata siciliana", "Tomate cereja confitado", "Mix de azeitonas", "Batatas confitadas", "Pasta de tomate seco", "Pasta de ervas"] } ] },
    { "nome": "Mesa de antepastos – Opção 02", "preco": 95, "formato": "Ilhas gastronômicas", "tags": ["Antepastos", "Recepção"],
      "secoes": [
        { "secao": "Mesa de pães", "itens": ["Pão de fermentação natural", "Croissant", "Focaccia"] },
        { "secao": "Queijos e embutidos", "itens": ["Salame italiano", "Gorgonzola", "Parmesão"] },
        { "secao": "Saladas", "itens": ["Salada caprese"] },
        { "secao": "Antepastos", "itens": ["Brie assado com massa folhada", "Abobrinha grelhada", "Caponata siciliana", "Tomate cereja confitado", "Batata bolinha confitada", "Mix de azeitonas", "Cebola em conserva", "Roast beef", "Damasco", "Castanhas variadas", "Pasta de tomate seco"] },
        { "secao": "Frutas, caldas e geleias", "itens": ["Calda de frutas vermelhas", "Geleia de laranja", "Uvas sem semente"] } ] },
    { "nome": "Buffet – Opção 01", "preco": 80, "formato": "Buffet", "tags": ["Buffet"],
      "secoes": [
        { "secao": "Saladas", "escolha": 1, "itens": ["Salada Caesar", "Salada de rúcula, morango e manga", "Salada mediterrânea", "Salada de couscous"] },
        { "secao": "Acompanhamentos", "escolha": 2, "itens": ["Arroz branco", "Arroz à grega", "Batata rústica", "Batata sauté", "Risoto funghi", "Risoto milanês"] },
        { "secao": "Massas", "titulo": "Massas lisas", "escolha": 1, "itens": ["Penne"] },
        { "secao": "Molhos", "escolha": 1, "itens": ["Molho branco", "Pomodoro e basílico", "Bolonhesa", "Ragú de linguiça"] },
        { "secao": "Massas de travessa", "escolha": 1, "itens": ["Lasanha bolonhesa", "Lasanha de queijo", "Lasanha de queijo e presunto"] },
        { "secao": "Frango e porco", "escolha": 1, "itens": ["Sobrecoxa de frango assada", "Frango xadrez", "Peito de frango grelhado", "Copa grelhada ao molho de limão", "Lombo suíno assado com laranja-pera"] },
        { "secao": "Carnes vermelhas", "escolha": 1, "itens": ["Alcatra grelhada com molho de cogumelos frescos", "Fraldinha marinada na mostarda", "Bife de chorizo com chimichurri", "Estrogonofe de carne"] },
        { "secao": "Sobremesas", "escolha": 2, "itens": ["Cheesecake", "Banoffee", "Mousse de limão com merengue italiano", "Mousse de maracujá"] } ] },
    { "nome": "Buffet – Opção 02", "preco": 105, "formato": "Buffet", "tags": ["Buffet"],
      "secoes": [
        { "secao": "Saladas", "escolha": 2, "itens": ["Salada Caesar", "Salada de folhas verdes, tomate cereja, gorgonzola e redução de aceto", "Salada de rúcula, morango e manga", "Salada caprese", "Salada mediterrânea", "Salada de couscous"] },
        { "secao": "Acompanhamentos", "escolha": 2, "itens": ["Arroz branco", "Arroz com amêndoas", "Arroz à grega", "Batata rústica", "Batata sauté", "Risoto funghi", "Risoto de gorgonzola, nozes e pêra", "Risoto milanês"] },
        { "secao": "Massas", "titulo": "Massas lisas", "escolha": 1, "itens": ["Penne", "Tagliarini"] },
        { "secao": "Molhos", "escolha": 2, "itens": ["Pomodoro e basílico", "Bolonhesa", "Alfredo", "Ragú de linguiça", "Ragú de fraldinha", "Funghi"] },
        { "secao": "Massas recheadas", "escolha": 1, "itens": ["Mix de queijos com molho de tomate e manjericão", "Gorgonzola e nozes com molho de pêra", "Linguiça com molho de queijo"] },
        { "secao": "Massas de travessa", "escolha": 1, "itens": ["Lasanha bolonhesa", "Lasanha de queijo", "Lasanha de queijo e presunto", "Rondelli de queijo e presunto", "Rondelli de ricota com espinafre", "Rondelli de rúcula com tomate seco"] },
        { "secao": "Frango e porco", "escolha": 1, "itens": ["Sobrecoxa de frango assada", "Frango xadrez", "Peito de frango recheado com queijo e bacon", "Peito de frango grelhado", "Estrogonofe de frango", "Copa grelhada ao molho de limão", "Lombo suíno assado com molho de damasco e bacon"] },
        { "secao": "Peixes", "escolha": 1, "itens": ["Peixe branco com manteiga de alcaparras", "Tilápia grelhada com crosta de tomate", "Tilápia grelhada à Belle Meunière"] },
        { "secao": "Carnes vermelhas", "escolha": 1, "itens": ["Alcatra grelhada com molho de cogumelos frescos", "Fraldinha marinada na mostarda", "Bife de chorizo com chimichurri", "Entrecôte ao molho madeira", "Estrogonofe de carne"] },
        { "secao": "Sobremesas", "escolha": 2, "itens": ["Cheesecake", "Banoffee", "Mousse de limão com merengue italiano", "Mousse de maracujá com Oreo", "Pudim de leite", "Brownie de chocolate"] } ] },
    { "nome": "Buffet – Opção 03", "preco": 140, "formato": "Buffet", "tags": ["Buffet", "Premium"],
      "secoes": [
        { "secao": "Saladas", "escolha": 3, "itens": ["Salada Caesar", "Salada de folhas verdes, tomate cereja, gorgonzola e redução de aceto", "Salada de rúcula, morango e manga", "Salada de folhas verdes, nozes, melão e presunto cru", "Salada caprese", "Salada mediterrânea", "Salada de couscous"] },
        { "secao": "Acompanhamentos", "escolha": 2, "itens": ["Arroz branco", "Arroz com amêndoas", "Arroz à grega", "Legumes grelhados", "Batata rústica", "Batata sauté", "Risoto funghi", "Risoto de gorgonzola, nozes e pêra", "Risoto milanês"] },
        { "secao": "Massas", "titulo": "Massas lisas", "escolha": 1, "itens": ["Penne", "Tagliarini", "Pappardelle"] },
        { "secao": "Molhos", "escolha": 3, "itens": ["Pomodoro e basílico", "Bolonhesa", "Alfredo", "Ragú de linguiça", "Ragú de fraldinha", "Funghi"] },
        { "secao": "Massas recheadas", "escolha": 1, "itens": ["Queijo com molho de tomate", "Camarão com molho de limão siciliano", "Gorgonzola e nozes com molho de pêra", "Linguiça com molho de queijo"] },
        { "secao": "Massas de travessa", "escolha": 2, "itens": ["Lasanha bolonhesa", "Lasanha de queijo", "Lasanha de queijo e presunto", "Rondelli de queijo e presunto", "Rondelli de ricota com espinafre", "Rondelli de rúcula com tomate seco", "Conchiglione com camarão e requeijão cremoso", "Conchiglione com figo ao molho branco"] },
        { "secao": "Frango e porco", "escolha": 1, "itens": ["Sobrecoxa de frango assada", "Frango xadrez", "Peito de frango recheado com queijo e bacon", "Peito de frango grelhado", "Costelinha de porco com molho barbecue", "Copa grelhada ao molho de limão", "Lombo suíno assado com molho de damasco e bacon"] },
        { "secao": "Peixes", "escolha": 1, "itens": ["Peixe branco com manteiga de alcaparras", "Tilápia grelhada com crosta de tomate", "Tilápia grelhada à Belle Meunière", "Pirarucu marinado com raspas de limão e gengibre", "Pirarucu com crosta de castanhas e limão caipira"] },
        { "secao": "Carnes vermelhas", "escolha": 1, "itens": ["Alcatra grelhada com molho de cogumelos frescos", "Fraldinha marinada na mostarda", "Bife de chorizo com chimichurri", "Entrecôte ao molho madeira"] },
        { "secao": "Sobremesas", "escolha": 3, "itens": ["Cheesecake", "Tiramissu", "Banoffee", "Mousse de limão com merengue italiano", "Mousse de maracujá com Oreo", "Pudim de leite", "Brownie de chocolate", "Pavlova"] } ] },
    { "nome": "Empratado – Opção 01 (1 prato principal)", "preco": 160, "formato": "Empratado", "tags": ["Empratado", "Jantar"],
      "secoes": [
        { "secao": "Entradas empratadas", "titulo": "Entradas", "escolha": 1, "itens": ["Salada de folhas verdes, presunto cru, gorgonzola e nozes", "Salada Caprese Casa Club", "Steak tartar empratado", "Polenta branca cremosa com cogumelos frescos"] },
        { "secao": "Pratos principais empratados", "titulo": "Prato principal", "escolha": 1, "itens": ["Risoto de pêra, nozes e gorgonzola", "Peixe branco com legumes confitados", "Bife de chorizo com batatas rústicas, vinagrete e farofa", "Paleta de cordeiro assada com talharim artesanal", "Miolo de alcatra com risoto de cogumelos", "Entrecôte grelhado com linguini, tomates e cogumelos"] },
        { "secao": "Sobremesas empratadas", "titulo": "Sobremesa", "escolha": 1, "itens": ["Mil-folhas com creme de chocolate", "Brownie de chocolate belga", "Cheesecake com frutas vermelhas", "Pavlova empratada"] } ] },
    { "nome": "Empratado – Opção 02 (2 pratos principais)", "preco": 220, "formato": "Empratado", "tags": ["Empratado", "Jantar"],
      "secoes": [
        { "secao": "Entradas empratadas", "titulo": "Entradas", "escolha": 1, "itens": ["Salada de folhas verdes, presunto cru, gorgonzola e nozes", "Salada Caprese Casa Club", "Steak tartar empratado", "Polenta branca cremosa com cogumelos frescos", "Salada de folhas verdes, gravlax de salmão e maçã verde"] },
        { "secao": "Pratos principais empratados", "titulo": "Primeiro prato", "escolha": 1, "itens": ["Risoto de pêra, nozes e gorgonzola", "Ravióli com cebola assada e queijo gruyère", "Ravióli com camarão", "Peixe branco com legumes confitados", "Linguini com lascas de bacalhau e tapenade"] },
        { "secao": "Pratos principais empratados", "titulo": "Segundo prato", "escolha": 1, "itens": ["Bife de chorizo com batatas rústicas, vinagrete e farofa", "Ravióli de queijo de cabra", "Paleta de cordeiro assada com talharim artesanal", "Mignon com risoto de cogumelos ao molho de vinho tinto", "Mignon com linguini, tomates frescos e cogumelos"] },
        { "secao": "Sobremesas empratadas", "titulo": "Sobremesa", "escolha": 1, "itens": ["Mil-folhas com creme de chocolate", "Brownie de chocolate belga", "Cheesecake com frutas vermelhas", "Queijos e geleias", "Pavlova empratada"] } ] },
    { "nome": "Empratado – Opção 03 (2 pratos principais)", "preco": 300, "formato": "Empratado", "tags": ["Empratado", "Jantar", "Premium"],
      "secoes": [
        { "secao": "Entradas empratadas", "titulo": "Entradas", "escolha": 1, "itens": ["Crabcake", "Lula recheada", "Codorna grelhada", "Polvo grelhado", "Salada de folhas verdes, gravlax de salmão e maçã verde", "Roastbeef de peito de pato"] },
        { "secao": "Pratos principais empratados", "titulo": "Primeiro prato", "escolha": 1, "itens": ["Ravióli com camarão", "Paella valenciana", "Bacalhau confitado", "Pirarucu com crosta de castanhas brasileiras"] },
        { "secao": "Pratos principais empratados", "titulo": "Segundo prato", "escolha": 1, "itens": ["Confit de pato", "Peito de pato", "Carré de cordeiro", "Paleta de cordeiro ao molho de cerveja preta", "Mignon com risoto de cogumelos ao molho de vinho tinto", "Costela bovina defumada"] },
        { "secao": "Sobremesas empratadas", "titulo": "Sobremesa", "escolha": 1, "itens": ["Mil-folhas com creme de cupuaçu e chocolate", "Queijos e geleias", "Queijo coalho grelhado", "Tiramissú", "Duo de crème brûlée"] } ] }
  ]
}
$json$;
    s JSONB;
    it JSONB;
    op JSONB;
    os JSONB;
    v_secao UUID;
    v_opcao UUID;
    v_opcao_secao UUID;
    v_item UUID;
    v_ordem INT;
    v_ordem_item INT;
    v_nome TEXT;
BEGIN
    SELECT id INTO v_tenant FROM tenants WHERE slug = 'banket';
    IF v_tenant IS NULL THEN
        RETURN;
    END IF;

    -- Recomeça o catálogo do tenant de demonstração
    DELETE FROM cardapio_opcoes WHERE tenant_id = v_tenant;
    DELETE FROM catalogo_secoes WHERE tenant_id = v_tenant;

    v_ordem := 0;
    FOR s IN SELECT * FROM jsonb_array_elements(dados->'secoes') LOOP
        v_ordem := v_ordem + 1;
        INSERT INTO catalogo_secoes (tenant_id, nome, descricao, ordem, preco, unidade_cobranca)
        VALUES (v_tenant, s->>'nome', s->>'descricao', v_ordem, (s->>'preco')::numeric, COALESCE(s->>'unidade', 'pessoa'))
        RETURNING id INTO v_secao;

        v_ordem_item := 0;
        FOR it IN SELECT * FROM jsonb_array_elements(s->'itens') LOOP
            v_ordem_item := v_ordem_item + 1;
            IF jsonb_typeof(it) = 'string' THEN
                it := jsonb_build_object('n', it #>> '{}');
            END IF;
            INSERT INTO catalogo_itens (
                tenant_id, secao_id, nome, descricao, ordem, preco, unidade_cobranca, restricoes, dados_operacionais,
                categoria_principal_id, categoria_secundaria_id, formato_servico_id)
            VALUES (
                v_tenant, v_secao, it->>'n', it->>'d', v_ordem_item, (it->>'p')::numeric, COALESCE(it->>'u', 'pessoa'),
                COALESCE(ARRAY(SELECT jsonb_array_elements_text(it->'r')), '{}'),
                COALESCE(ARRAY(SELECT jsonb_array_elements_text(it->'o')), '{}'),
                (SELECT id FROM categorias_item WHERE tenant_id = v_tenant AND tipo = 'principal' AND nome = s->>'principal'),
                (SELECT id FROM categorias_item WHERE tenant_id = v_tenant AND tipo = 'secundaria' AND nome = s->>'secundaria'),
                (SELECT id FROM formatos_servico WHERE tenant_id = v_tenant AND nome = s->>'formato'));
        END LOOP;
    END LOOP;

    FOR op IN SELECT * FROM jsonb_array_elements(dados->'opcoes') LOOP
        INSERT INTO cardapio_opcoes (tenant_id, nome, descricao, preco_por_pessoa, duracao_horas, formato_servico_id, tags)
        VALUES (
            v_tenant, op->>'nome', op->>'descricao', (op->>'preco')::numeric, (op->>'duracao')::numeric,
            (SELECT id FROM formatos_servico WHERE tenant_id = v_tenant AND nome = op->>'formato'),
            COALESCE(ARRAY(SELECT jsonb_array_elements_text(op->'tags')), '{}'))
        RETURNING id INTO v_opcao;

        v_ordem := 0;
        FOR os IN SELECT * FROM jsonb_array_elements(op->'secoes') LOOP
            v_ordem := v_ordem + 1;
            SELECT id INTO v_secao FROM catalogo_secoes WHERE tenant_id = v_tenant AND nome = os->>'secao';
            IF v_secao IS NULL THEN
                RAISE EXCEPTION 'Seed: sessão "%" não encontrada (opção "%")', os->>'secao', op->>'nome';
            END IF;
            INSERT INTO cardapio_opcao_secoes (tenant_id, opcao_id, secao_id, titulo, escolha_qtd, ordem)
            VALUES (v_tenant, v_opcao, v_secao, os->>'titulo', (os->>'escolha')::int, v_ordem)
            RETURNING id INTO v_opcao_secao;

            v_ordem_item := 0;
            FOR v_nome IN SELECT jsonb_array_elements_text(os->'itens') LOOP
                v_ordem_item := v_ordem_item + 1;
                SELECT id INTO v_item FROM catalogo_itens WHERE secao_id = v_secao AND nome = v_nome;
                IF v_item IS NULL THEN
                    RAISE EXCEPTION 'Seed: item "%" não encontrado na sessão "%"', v_nome, os->>'secao';
                END IF;
                INSERT INTO cardapio_opcao_itens (tenant_id, opcao_secao_id, item_id, ordem)
                VALUES (v_tenant, v_opcao_secao, v_item, v_ordem_item);
            END LOOP;
        END LOOP;
    END LOOP;
END $seed$;
