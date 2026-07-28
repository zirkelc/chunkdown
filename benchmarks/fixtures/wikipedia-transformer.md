---
title: Transformer
source: https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)
license: CC BY-SA 4.0
---

# Transformer

In [deep learning](https://en.wikipedia.org/wiki/Deep_learning), the **transformer** is a family of [artificial neural network](https://en.wikipedia.org/wiki/Artificial_neural_network) architectures based on the multi-head [attention](https://en.wikipedia.org/wiki/Attention_(machine_learning)) mechanism, in which text is converted to numerical representations called [tokens](https://en.wikipedia.org/wiki/Large_language_model#Tokenization), and each token is converted into a vector via lookup from a [word embedding](https://en.wikipedia.org/wiki/Word_embedding) table. At each layer, each [token](https://en.wikipedia.org/wiki/Tokenization_(lexical_analysis)) is then [contextualized](https://en.wikipedia.org/wiki/Contextualization_(computer_science)) within the scope of the [context window](https://en.wikipedia.org/wiki/Context_window) with other (unmasked) tokens via a parallel multi-head attention mechanism, allowing the signal for key tokens to be amplified and less important tokens to be diminished. Because self-attention alone is permutation-invariant, transformers inject positional information, typically through positional encodings or learned positional embeddings, so token order can affect the output.

Transformers have the advantage of having no recurrent units, therefore requiring less training time than earlier [recurrent neural architectures](https://en.wikipedia.org/wiki/Recurrent_neural_network) (RNNs) such as [long short-term memory](https://en.wikipedia.org/wiki/Long_short-term_memory) (LSTM). Later variations have been widely adopted for training [large language models](https://en.wikipedia.org/wiki/Large_language_model) (LLMs) on large (language) [datasets](https://en.wikipedia.org/wiki/Training,_validation,_and_test_data_sets). Modern transformer designs are commonly grouped into encoder-only, decoder-only, and encoder-decoder variants, depending on whether they are optimized for representation learning, autoregressive generation, or conditional sequence-to-sequence tasks.

The original version of the transformer architecture was proposed in the 2017 paper "[Attention Is All You Need](https://en.wikipedia.org/wiki/Attention_Is_All_You_Need)" by researchers at [Google](https://en.wikipedia.org/wiki/Google). The predecessors of transformers were developed as an improvement over previous architectures for [machine translation](https://en.wikipedia.org/wiki/Machine_translation), but have found many applications since. They are used in large-scale [natural language processing](https://en.wikipedia.org/wiki/Natural_language_processing), [computer vision](https://en.wikipedia.org/wiki/Computer_vision) ([vision transformers](https://en.wikipedia.org/wiki/Vision_transformer)), [reinforcement learning](https://en.wikipedia.org/wiki/Reinforcement_learning), [audio](https://en.wikipedia.org/wiki/Audio_signal_processing), [multimodal learning](https://en.wikipedia.org/wiki/Multimodal_learning), [robotics](https://en.wikipedia.org/wiki/Robotics), and playing [chess](https://en.wikipedia.org/wiki/Computer_chess). It has also led to the development of [pre-trained systems](https://en.wikipedia.org/wiki/Transfer_learning), such as [generative pre-trained transformers](https://en.wikipedia.org/wiki/Generative_pre-trained_transformer) (GPTs) and [BERT](https://en.wikipedia.org/wiki/BERT_(language_model)) (bidirectional encoder representations from transformers).

## History

### Predecessors

For many years, sequence modelling and generation was done by using plain [recurrent neural networks](https://en.wikipedia.org/wiki/Recurrent_neural_network) (RNNs). A well-cited early example was the [Elman network](https://en.wikipedia.org/wiki/Elman_network) (1990). In theory, the information from one token can propagate arbitrarily far down the sequence, but in practice the [vanishing-gradient problem](https://en.wikipedia.org/wiki/Vanishing-gradient_problem) leaves the model's state at the end of a long sentence without precise, extractable information about preceding tokens.

A key breakthrough was [LSTM](https://en.wikipedia.org/wiki/Long_short-term_memory) (originally described in a 1995 technical report and formally published in 1997), an RNN that introduced gating mechanisms to mitigate the vanishing gradient problem, allowing efficient learning of long-sequence modelling. One key architectural element was the use of _multiplicative gating units_, in which the outputs of some neurons modulate the outputs of others. These multiplicative units are conceptually distinct from the additive attention mechanism later introduced for sequence-to-sequence models.  Neural networks using multiplicative units were later called _sigma-pi networks_ or _higher-order networks_. LSTM became the standard architecture for long sequence modelling until the 2017 publication of transformers. However, LSTM still used sequential processing, like most other RNNs. Specifically, RNNs operate one token at a time from first to last; they cannot operate in parallel over all tokens in a sequence.

Modern transformers overcome this problem, but unlike RNNs, they require computation time that is [quadratic](https://en.wikipedia.org/wiki/Quadratic_function) in the size of the context window. The linearly scaling fast weight controller (1992) learns to compute a weight matrix for further processing depending on the input. One of its two networks has "fast weights" or "dynamic links" (1981). A slow neural network learns by gradient descent to generate keys and values for computing the weight changes of the fast neural network which computes answers to queries. This was later shown to be equivalent to the unnormalized linear transformer.

### Attention with seq2seq

The idea of encoder–decoder sequence transduction had been developed in the early 2010s; commonly cited as the originators that produced seq2seq are two concurrently published papers from 2014.

A 380M-parameter model for machine translation uses two [long short-term memories](https://en.wikipedia.org/wiki/Long_short-term_memory) (LSTM). Its architecture consists of two parts. The _encoder_ is an LSTM that takes in a sequence of tokens and turns it into a vector. The _decoder_ is another LSTM that converts the vector into a sequence of tokens. Similarly, another 130M-parameter model used [gated recurrent units](https://en.wikipedia.org/wiki/Gated_recurrent_unit) (GRU) instead of LSTM. Later research showed that GRUs are neither better nor worse than LSTMs for seq2seq.

These early seq2seq models had no attention mechanism, and the state vector is accessible only after the _last_ word of the source text was processed. Although in theory such a vector retains the information about the whole original sentence, in practice the information is poorly preserved. This is because the input is processed sequentially by one recurrent network into a _fixed_\-size output vector, which is then processed by another recurrent network into an output. If the input is long, then the output vector would not be able to contain all relevant information, degrading the output. As evidence, reversing the input sentence improved seq2seq translation.

The _RNN search_ model introduced an attention mechanism to seq2seq for machine translation to solve the bottleneck problem (of the _fixed-size_ output vector), allowing the model to process long-distance dependencies more easily. The name is because it "emulates searching through a source sentence during decoding a translation".

The relative performances were compared between global (that of _RNN search_) and local (sliding window) attention model architectures for machine translation, finding that mixed attention had higher quality than global attention, while local attention reduced translation time.

In 2016, [Google Translate](https://en.wikipedia.org/wiki/Google_Translate) was revamped to [Google Neural Machine Translation](https://en.wikipedia.org/wiki/Google_Neural_Machine_Translation), which replaced the previous model based on [statistical machine translation](https://en.wikipedia.org/wiki/Statistical_machine_translation). The new model was a seq2seq model where the encoder and the decoder were both 8 layers of bidirectional LSTM. It took nine months to develop, and it outperformed the statistical approach, which took ten years to develop.

### Parallelizing attention

Seq2seq models with attention (including self-attention) still suffered from the same issue with recurrent networks, which is that they are hard to [parallelize](https://en.wikipedia.org/wiki/Parallel_computing), which prevented them from being accelerated on GPUs. In 2016, _decomposable attention_ applied a self-attention mechanism to [feedforward networks](https://en.wikipedia.org/wiki/Feedforward_neural_network), which are easy to parallelize, and achieved [SOTA](https://en.wikipedia.org/wiki/State_of_the_art) result in [textual entailment](https://en.wikipedia.org/wiki/Textual_entailment) with an order of magnitude fewer parameters than LSTMs. One of its authors, Jakob Uszkoreit, suspected that attention _without_ recurrence would be sufficient for language translation, thus the title "attention is _all_ you need". That hypothesis was against conventional wisdom at the time, and even his father [Hans Uszkoreit](https://en.wikipedia.org/wiki/Hans_Uszkoreit), a well-known computational linguist, was skeptical. In the same year, self-attention (called _intra-attention or_ _intra-sentence attention_) was proposed for LSTMs.

On 2017-06-12, the original (100M-parameter) encoder–decoder transformer model was published in the "[Attention is all you need](https://en.wikipedia.org/wiki/Attention_is_all_you_need)" paper. At the time, the focus of the research was on improving [seq2seq](https://en.wikipedia.org/wiki/Seq2seq) for [machine translation](https://en.wikipedia.org/wiki/Machine_translation), by removing its recurrence to process all tokens in parallel, but preserving its dot-product attention mechanism to keep its text processing performance. This led to the introduction of a multi-head attention model that was easier to parallelize due to the use of independent heads and the lack of recurrence. Its parallelizability was an important factor to its widespread use in large neural networks.

### AI boom era

As early as spring 2017, even before the "Attention is all you need" preprint was published, one of the co-authors applied the "decoder-only" variation of the architecture to generate fictitious Wikipedia articles. Transformer architecture is now used alongside many [generative models](https://en.wikipedia.org/wiki/Generative_artificial_intelligence) that contribute to the ongoing [AI boom](https://en.wikipedia.org/wiki/AI_boom).

The "reference implementation" of the original Transformer was written in a TensorFlow library. In language modelling, [ELMo](https://en.wikipedia.org/wiki/ELMo) (2018) was a bi-directional LSTM that produces contextualized [word embeddings](https://en.wikipedia.org/wiki/Word_embedding), improving upon the line of research from [bag of words](https://en.wikipedia.org/wiki/Bag-of-words_model) and [word2vec](https://en.wikipedia.org/wiki/Word2vec). It was followed by [BERT](https://en.wikipedia.org/wiki/BERT_(language_model)) (2018), an encoder-only transformer model. In October 2019, Google started using BERT to process search queries. In 2020, Google Translate replaced the previous RNN-encoder–RNN-decoder model by a transformer-encoder–RNN-decoder model.

Starting in 2018, the OpenAI [GPT series](https://en.wikipedia.org/wiki/Generative_pre-trained_transformer) of decoder-only transformers became state of the art in [natural language generation](https://en.wikipedia.org/wiki/Natural_language_generation). At the end of 2022, [ChatGPT](https://en.wikipedia.org/wiki/ChatGPT), a chatbot based on a fine-tuned variant of GPT-3.5, became unexpectedly popular, triggering a boom around [large language models](https://en.wikipedia.org/wiki/Large_language_model).

Transformers have been applied in modalities beyond text. Four days after the publication of "Attention is All You Need", a [multimodal](https://en.wikipedia.org/wiki/Multimodal_learning) transformer architecture, MultiModel, was published by most authors of that paper. Other examples include the [vision transformer](https://en.wikipedia.org/wiki/Vision_transformer), speech recognition, robotics, and multimodal. The vision transformer, in turn, stimulated new developments in [convolutional neural networks](https://en.wikipedia.org/wiki/Convolutional_neural_network). Image and video generators like [DALL-E](https://en.wikipedia.org/wiki/DALL-E) (2021), [Stable Diffusion 3](https://en.wikipedia.org/wiki/Stable_Diffusion) (2024), and [Sora](https://en.wikipedia.org/wiki/Sora_(text-to-video_model)) (2024), use transformers to analyse input data (like text prompts) by breaking it down into "tokens" and then calculating the relevance between each token using self-attention, which helps the model understand the context and relationships within the data.

## Training

### Methods for stabilizing training

The plain transformer architecture had difficulty in converging. In the original paper, the authors recommended using [learning rate](https://en.wikipedia.org/wiki/Learning_rate) warmup. That is, the learning rate should linearly scale up from 0 to maximal value for the first part of the training (usually recommended to be 2% of the total number of training steps), before decaying again.

A 2020 paper found that using [layer normalization](https://en.wikipedia.org/wiki/Layer_normalization) _before_ (instead of after) multihead attention and feedforward layers stabilizes training, not requiring learning rate warmup. This is the "pre-LN Transformer" and is more commonly used, compared to the original "post-LN Transformer".

### Pretrain-finetune

Transformers typically are first pretrained by [self-supervised learning](https://en.wikipedia.org/wiki/Self-supervised_learning) on a large generic dataset, followed by [supervised](https://en.wikipedia.org/wiki/Supervised_learning) [fine-tuning](https://en.wikipedia.org/wiki/Fine-tuning_(deep_learning)) on a small task-specific dataset. The pretrain dataset is typically an unlabeled large corpus, such as [The Pile](https://en.wikipedia.org/wiki/The_Pile_(dataset)). Tasks for pretraining and fine-tuning commonly include:

-   [language modeling](https://en.wikipedia.org/wiki/Language_modeling)
-   next-sentence prediction
-   [question answering](https://en.wikipedia.org/wiki/Question_answering)
-   [reading comprehension](https://en.wikipedia.org/wiki/Natural-language_understanding)
-   [sentiment analysis](https://en.wikipedia.org/wiki/Sentiment_analysis)
-   [paraphrasing](https://en.wikipedia.org/wiki/Text_Summaries)

The [T5 transformer](https://en.wikipedia.org/wiki/T5_(language_model)) report documents a large number of [natural language](https://en.wikipedia.org/wiki/Natural_language) pretraining tasks. Some examples are:

-   restoring or repairing incomplete or corrupted text. For example, the input, _"Thank you ~~ me to your party ~~ week",_ might generate the output, _"Thank you **for inviting** me to your party **last** week"._
-   translation between natural languages ([machine translation](https://en.wikipedia.org/wiki/Machine_translation))
-   judging the pragmatic acceptability of natural language. For example, the following sentence might be judged "not acceptable", because even though it is syntactically well-formed, it is improbable in ordinary human usage: _The course is jumping well._

While each of these tasks is trivial or obvious for human native speakers of the language (or languages), they have typically proved challenging for previous generations of machine learning architecture.

### Tasks

In general, there are three classes of language modelling tasks: "masked", "autoregressive", and "prefixLM". These classes are independent of a specific modeling architecture such as transformer, but they are often discussed in the context of transformer.

In a masked task, one or more of the tokens is masked out, and the model would produce a probability distribution predicting what the masked-out tokens are based on the context. The [loss function](https://en.wikipedia.org/wiki/Loss_function) for the task is typically sum of [log-perplexities](https://en.wikipedia.org/wiki/Perplexity) for the masked-out tokens:  and the model is trained to minimize this loss function. The [BERT series of models](https://en.wikipedia.org/wiki/BERT_(language_model)) are trained for masked token prediction and another task. ("Masked" as in "masked language modelling" is not "masked" as in "[masked attention](https://en.wikipedia.org/wiki/Transformer_(deep_learning)#Masked_attention)".)

In an autoregressive task, the entire sequence is masked at first, and the model produces a probability distribution for the first token. Then the first token is revealed and the model predicts the second token, and so on. The loss function for the task is still typically the same. The [GPT series of models](https://en.wikipedia.org/wiki/Generative_pre-trained_transformer) are trained by autoregressive tasks.

In a prefixLM task, the sequence is divided into two parts. The first part is presented as context, and the model predicts the first token of the second part. Then that would be revealed, and the model predicts the second token, and so on. The loss function for the task is still typically the same. The [T5 series of models](https://en.wikipedia.org/wiki/T5_(language_model)) are trained by prefixLM tasks. ("PrefixLM" as in "prefix language modeling" is not "prefixLM" as in "[prefix language model](https://en.wikipedia.org/wiki/Transformer_(deep_learning)#prefixLM)".)

## Architecture

All transformers have the same primary components:

-   Tokenizers, which convert text into tokens.
-   Embedding layer, which converts tokens and positions of the tokens into vector representations.
-   Transformer layers, which carry out repeated transformations on the vector representations, extracting more and more linguistic information. These consist of alternating attention and feedforward layers. There are two major types of transformer layers: encoder layers and decoder layers, with further variants.
-   Un-embedding layer, which converts the final vector representations back to a probability distribution over the tokens.

The following description follows exactly the transformer as described in the original paper. There are variants, described in the [following section](https://en.wikipedia.org/wiki/Transformer_(deep_learning)#Subsequent_work).

By convention, we write all vectors as row vectors. For example, pushing a vector through a linear layer means multiplying it by a weight matrix on the right, as  .

### Tokenization

As the transformer architecture natively consists of operations over numbers (matrix multiplications, dot products, activation functions) rather than over text, there must first be a mapping from any input text to some numerical representation. This happens in three steps.

First, the input text is treated by a _preprocessor_, which performs both textual transformations and splits the text into coarse-grained segments called _pretokens_. The latter is referred to as _pretokenization_. Second, each pretoken is segmented further into _tokens_ by a _tokenizer_ that expects to only see pretokens output by its preprocessor. Each token it produces is a string of one or more characters belonging to a finite set of strings called the _vocabulary_  . Third, because the vocabulary is finite and known beforehand, each token can be assigned an integer identifier, and this mapping is applied to the sequence of tokens to represent any input text as a numerical sequence. Since this mapping is bijective, the output side can produce a sequence of integer identifiers which can then be turned back into tokens. After undoing some of the preprocessing, the result is again legible text.

Training a tokenizer (sometimes referred to as _vocabularization_) means finding a suitable vocabulary  , but also learning how to use it, since any given string   of length   has   hypothetical segmentations, some of which containing segments that are not in the vocabulary. The most important hyperparameter during vocabularization is the _vocabulary size_  : when it is small, the learned vocabulary generally consists of characters and smaller strings, and words will be segmented into many tokens. At larger sizes, it becomes affordable to dedicate tokens to full words, although depending on the preprocessor and tokenizer, it is not necessarily the case that large vocabularies will always use the largest token(s) available to segment a word.

Because tokens are not always full words, they may also be referred to as _subwords_ and tokenization algorithms may be referred to as _subword tokenizers_. This is also to differentiate these systems from [traditional terminology](https://en.wikipedia.org/wiki/Lexical_analysis) used in older information retrieval and natural language processing systems, where "tokenization" was used to denote what is today called "pretokenization" (very crudely: splitting into words). In tokenizers that produce tokens that are _not_ part of the vocabulary, a special token that does belong to the vocabulary is used as a generic stand-in, written as "\[UNK\]" for "unknown". In principle, any string could be hidden by such an \[UNK\]. Indeed, in information retrieval, pretokenizers were themselves used as tokenizers (and also called "tokenizers") with a word-level vocabulary that contained an \[UNK\].

Commonly used subword tokenization algorithms are [byte pair encoding](https://en.wikipedia.org/wiki/Byte_pair_encoding) (BPE) and the unigram language model (ULM), which each include a vocabularization algorithm and a dedicated segmentation algorithm. There also exist several segmentation algorithms that require no learning and can be applied given a vocabulary (produced by BPE or ULM, for example), like greedily recognising tokens in a pretoken by moving through it left-to-right. Well-known software implementations of subword tokenizers are [Hugging Face](https://en.wikipedia.org/wiki/Hugging_Face)'s `tokenizers` Python package implemented in Rust, and the `sentencepiece` Python package implemented in C++. The latter package is named as such because one of its configuration options allows disabling the built-in pretokenizer, hence effectively making entire sentences a pretoken and thus having the tokenizer see entire sentences, rather than individual words.

### Embedding

Each integer token identifier is converted into an embedding vector via a [lookup table](https://en.wikipedia.org/wiki/Lookup_table). Equivalently stated, it multiplies a [one-hot](https://en.wikipedia.org/wiki/One-hot) representation of the token identifier by an embedding matrix  . For example, if the input token's identifier is  , then the one-hot representation is  , and its embedding vector is  The token embedding vectors are added to their respective positional encoding vectors (see below), producing the sequence of input vectors.

The dimension of an embedding vector is called _hidden size_ or _embedding size_ and written as  . This size is written as   in the original transformer paper.

### Un-embedding

An un-embedding layer is almost the reverse of an embedding layer. Whereas an embedding layer converts a token identifier into a vector, an un-embedding layer converts a vector into a probability distribution over tokens.

The un-embedding layer is a linear-[softmax](https://en.wikipedia.org/wiki/Softmax_function) layer:  The matrix has shape  . Some architectures use the transpose of the embedding matrix   as the un-embedding matrix   in order to avoid needing double the amount of embedding-related parameters and to avoid divergence during training. This practice is called _weight tying_.

### Positional encoding

A positional encoding is a fixed-size vector representation of the relative positions of tokens within a sequence: it provides the transformer model with information about _where_ the words are in the input sequence. This induces a [bias](https://en.wikipedia.org/wiki/Inductive_bias) towards the order of the input sequence, so that, for example, the input sequence "[man bites dog](https://en.wikipedia.org/wiki/Man_bites_dog)" is processed differently from "dog bites man".

The positional encoding is defined as a function of type  , where   is a positive even [integer](https://en.wikipedia.org/wiki/Integer). The full positional encoding defined in the original paper is:  where  .

Here,   is a free parameter that should be significantly larger than the biggest   that would be input into the positional encoding function. The original paper uses  .

The function is in a simpler form when written as a complex function of type   where  .

The main reason for using this positional encoding function is that using it, shifts are linear transformations:  where   is the distance one wishes to shift. This allows the transformer to take any encoded position, and find the encoding of the position n-steps-ahead or n-steps-behind, by a matrix multiplication.

By taking a linear sum, any convolution can also be implemented as linear transformations:  for any constants  . This allows the transformer to take any encoded position and find a linear sum of the encoded locations of its neighbors. This sum of encoded positions, when fed into the attention mechanism, would create attention weights on its neighbors, much like what happens in a [convolutional neural network](https://en.wikipedia.org/wiki/Convolutional_neural_network) [language model](https://en.wikipedia.org/wiki/Language_model). In the author's words, "we hypothesized it would allow the model to easily learn to attend by relative position."

In typical implementations, all operations are done over the real numbers, not the complex numbers, but since [complex multiplication can be implemented as real 2-by-2 matrix multiplication](https://en.wikipedia.org/wiki/Complex_number#Matrix_representation_of_complex_numbers), this is a mere notational difference.

### Encoder–decoder (overview)

Like earlier [seq2seq](https://en.wikipedia.org/wiki/Seq2seq) models, the original transformer model used an **encoder–decoder** architecture. The encoder consists of encoding layers that process all the input tokens together one layer after another, while the decoder consists of decoding layers that iteratively process the encoder's output and the decoder's output tokens so far.

The purpose of each encoder layer is to create contextualized representations of the tokens, where each representation corresponds to a token that "mixes" information from other input tokens via self-attention mechanism. Each decoder layer contains two attention sublayers: (1) cross-attention for incorporating the output of encoder (contextualized input token representations), and (2) self-attention for "mixing" information among the input tokens to the decoder (i.e. the tokens generated so far during inference time).

Both the encoder and decoder layers have a [feed-forward neural network](https://en.wikipedia.org/wiki/Feedforward_neural_network) for additional processing of their outputs and contain residual connections and layer normalization steps. These feed-forward layers contain most of the parameters in a transformer model.

### Feedforward network

The feedforward network (FFN) modules in a transformer are 2-layered [multilayer perceptrons](https://en.wikipedia.org/wiki/Feedforward_neural_network):  where   and   are weight matrices and   and   are bias vectors, and   is its activation function. The original transformer used [ReLU](https://en.wikipedia.org/wiki/Rectifier_(neural_networks)) activation.

The number of neurons in the middle layer is called _intermediate size_ (GPT), _filter size_ (BERT), or _feedforward size_ (BERT). It is typically larger than the embedding size. For example, in both GPT-2 series and BERT series, the intermediate size of a model is 4 times its embedding size:  .

### Scaled dot-product attention

#### Attention head

The attention mechanism used in the transformer architecture are scaled [dot-product](https://en.wikipedia.org/wiki/Dot_product) [attention](https://en.wikipedia.org/wiki/Attention_(machine_learning)) units. For each unit, the transformer model learns three weight matrices: the query weights  , the key weights  , and the value weights  .

The module takes three sequences, a query sequence, a key sequence, and a value sequence. The query sequence is a sequence of length  , and each entry is a vector of dimension  . Similarly for the key and value sequences.

For each vector   in the query sequence, it is multiplied by a matrix   to produce a query vector  . The matrix of all query vectors is the query matrix:  Similarly, we construct the key matrix   and the value matrix  .

It is usually the case that all   are square matrices, meaning  , etc.

Attention weights are calculated using the query and key vectors: the attention weight   from token   to token   is the [dot product](https://en.wikipedia.org/wiki/Dot_product) between   and  . The attention weights are divided by the square root of the dimension of the key vectors,  , which stabilizes gradients during training, and passed through a [softmax](https://en.wikipedia.org/wiki/Softmax_function) which normalizes the weights. The fact that   and   are different matrices allows attention to be non-symmetric: if token   attends to token   (i.e.   is large), this does not necessarily mean that token   will attend to token   (i.e.   could be small). The output of the attention unit for token   is the weighted sum of the value vectors of all tokens, weighted by  , the attention from token   to each token.

The attention calculation for all tokens can be expressed as one large matrix calculation using the [softmax function](https://en.wikipedia.org/wiki/Softmax_function), which is useful for training due to computational matrix operation optimizations that quickly compute matrix operations. The matrices  ,   and   are defined as the matrices where the  th rows are vectors  ,  , and   respectively. Then we can represent the attention as

where the softmax is applied over each of the rows of the matrix.

The number of dimensions in a query vector is _query size_   and similarly for the _key size_   and _value size_  . The output dimension of an attention head is its _head dimension_  . The attention mechanism requires the following three equalities to hold:  but is otherwise unconstrained.

If the attention head is used in a self-attention fashion, then  . If the attention head is used in a cross-attention fashion, then usually  . It is theoretically possible for all three to be different, but that is rarely the case in practice.

#### Multihead attention

One set of   matrices is called an _attention head_, and each layer in a transformer model has multiple attention heads. While each attention head attends to the tokens that are relevant to each token, multiple attention heads allow the model to do this for different definitions of "relevance". Specifically, the query and key projection matrices,   and   , which are involved in the attention score computation, defines the "relevance". Meanwhile, the value [projection matrix](https://en.wikipedia.org/wiki/Projection_matrix)  , in combination with the part of the output projection matrix  , determines how the attended tokens influence what information is passed to subsequent layers and ultimately the output logits. In addition, the scope of attention, or the range of token relationships captured by each attention head, can expand as tokens pass through successive layers. This allows the model to capture more complex and long-range dependencies in deeper layers. Many transformer attention heads encode relevance relations that are meaningful to humans. For example, some attention heads can attend mostly to the next word, while others mainly attend from verbs to their direct objects. The computations for each attention head can be performed in [parallel](https://en.wikipedia.org/wiki/Parallel_computing), which allows for fast processing. The outputs for the attention layer are concatenated to pass into the [feedforward neural network](https://en.wikipedia.org/wiki/Feedforward_neural_network) layers.

Concretely, let the multiple attention heads be indexed by  , then we have  where the matrix   is the concatenation of word embeddings, and the matrices   are "projection matrices" owned by individual attention head  , and   is a final projection matrix owned by the whole multihead attention head.

It is theoretically possible for each attention head to have a different head dimension  , but that is rarely the case in practice.

As an example, in the smallest GPT-2 model, there are only self-attention mechanisms. It has the following dimensions:  Since  , its output projection matrix   is a square matrix.

#### Masked attention

The transformer architecture is constructed to calculate output tokens iteratively. Assuming   refers to the calculation of the first output token  , for step  , the output token   shall remain constant. This ensures properties of the model similar to [autoregressive models](https://en.wikipedia.org/wiki/Autoregressive_models). Therefore, at every time step  , the calculation for all outputs   should not have access to tokens at position   for   (as it naturally is the case for time step  , when tokens   are not yet calculated). This behavior may be accomplished before the softmax stage by adding a mask matrix   that is   at entries where the attention link must be cut, and   at other places:  The following matrix is commonly used in decoder self-attention modules, called "causal masking":

In words, it means that each token can pay attention to itself, and every token before it, but not any after it. A non-masked attention module can be thought of as a masked attention module where the mask has all entries zero. As an example of an uncommon use of mask matrix, the [XLNet](https://en.wikipedia.org/wiki/XLNet) considers all masks of the form  , where   is a random [permutation matrix](https://en.wikipedia.org/wiki/Permutation_matrix).

### Encoder

An encoder consists of an embedding layer, followed by multiple encoder layers.

Each encoder layer consists of two major components: a self-attention mechanism and a feed-forward layer. It takes an input as a sequence of input vectors, applies the self-attention mechanism, to produce an intermediate sequence of vectors, then applies the feed-forward layer for each vector individually. Schematically, we have:

where   stands for "feed-forward network". We can more succinctly write it as  with the implicit convention that the   is applied to each row of the matrix individually.

The encoder layers are stacked. The first encoder layer takes the sequence of input vectors from the embedding layer, producing a sequence of vectors. This sequence of vectors is processed by the second encoder, and so on. The output from the final encoder layer is then used by the decoder.

As the encoder processes the entire input all at once, every token can attend to every other token (all-to-all attention), so there is no need for causal masking.

### Decoder

A decoder consists of an embedding layer, followed by multiple decoder layers, followed by an un-embedding layer.

Each decoder consists of three major components: a causally masked self-attention mechanism, a cross-attention mechanism, and a feed-forward neural network. The decoder functions in a similar fashion to the encoder, but an additional attention mechanism is inserted which instead draws relevant information from the encodings generated by the encoders. This mechanism can also be called the _encoder–decoder attention_.

Like the first encoder, the first decoder takes positional information and embeddings of the output sequence as its input, rather than encodings. The transformer must not use the current or future output to predict an output, so the output sequence must be partially masked to prevent this reverse information flow. This allows for [autoregressive](https://en.wikipedia.org/wiki/Autoregressive_model) text generation. For decoding, all-to-all attention is inappropriate, because a token cannot attend to tokens not yet generated. Thus, the self-attention module in the decoder is causally masked.

In contrast, the cross-attention mechanism attends to the output vectors of the encoder, which is computed before the decoder starts decoding. Consequently, there is no need for masking in the cross-attention mechanism.

Schematically, we have:  where   is the matrix with rows being the output vectors from the encoder.

The last decoder is followed by a final un-embedding layer to produce the output probabilities over the vocabulary. Then, one of the tokens is sampled according to the probability, and the decoder can be run again to produce the next token, etc., autoregressively generating output text.

## Full transformer architecture

### Sublayers

Each encoder layer contains 2 sublayers: the self-attention and the feedforward network. Each decoder layer contains 3 sublayers: the causally masked self-attention, the cross-attention, and the feedforward network.

The final points of detail are the [residual connections](https://en.wikipedia.org/wiki/Residual_neural_network) and [layer normalization](https://en.wikipedia.org/wiki/Layer_normalization), (denoted as "LayerNorm", or "LN" in the following), which while conceptually unnecessary, are necessary for numerical stability and convergence.

The residual connections are introduced to avoid vanishing gradient issues and stabilize the training process. They can be expressed by  , where   is a given component of the transformer. Adding the input   can preserve the input information and avoid issues when the gradient of   is close to zero.

Similarly to how the feedforward network modules are applied individually to each vector, the LayerNorm is also applied individually to each vector.

There are two common conventions in use: the _post-LN_ and the _pre-LN_ convention. In the post-LN convention, the output of each sublayer is  where   is the function implemented by the sublayer itself.

In the pre-LN convention, the output of each sublayer is  The original 2017 transformer used the post-LN convention. It was difficult to train and required careful hyperparameter tuning and a "warm-up" in learning rate, where it starts small and gradually increases. The pre-LN convention, proposed several times in 2018, was found to be easier to train, requiring no warm-up, leading to faster convergence.

### Pseudocode

The following is the pseudocode for a standard pre-LN encoder–decoder transformer, adapted from _Formal Algorithms for Transformers_

**input:** Encoder input t\_e
       Decoder input t\_d
**output:** Array of probability distributions, with shape (decoder vocabulary size x length(decoder output sequence))

/\* encoder \*/
z\_e ← encoder.tokenizer(t\_e)

**for** **each** t **in** 1:length(z\_e) **do**
    z\_e\[t\] ← encoder.embedding(z\_e\[t\]) + encoder.positional\_embedding(t)

**for** **each** l **in** 1:length(encoder.layers) **do**
    layer ← encoder.layers\[l\]

    /\* first sublayer \*/
    z\_e\_copy ← copy(z\_e)
    **for each** t **in** 1:length(z\_e) **do**
        z\_e\[t\] ← layer.layer\_norm(z\_e\[t\])
    z\_e ← layer.multihead\_attention(z\_e, z\_e, z\_e)
    **for each** t **in** 1:length(z\_e) **do**
        z\_e\[t\] ← z\_e\[t\] + z\_e\_copy\[t\]

    /\* second sublayer \*/
    z\_e\_copy ← copy(z\_e)
    **for each** t **in** 1:length(z\_e) **do**
        z\_e\[t\] ← layer.layer\_norm(z\_e\[t\])
    z\_e ← layer.feedforward(z\_e)
    **for each** t **in** 1:length(z\_e) **do**
        z\_e\[t\] ← z\_e\[t\] + z\_e\_copy\[t\]

**for each** t **in** 1:length(z\_e) **do**
    z\_e\[t\] ← encoder.final\_layer\_norm(z\_e\[t\])

/\* decoder \*/
z\_d ← decoder.tokenizer(t\_d)

**for** **each** t **in** 1:length(z\_d) **do**
    z\_d\[t\] ← decoder.embedding(z\_d\[t\]) + decoder.positional\_embedding(t)

**for** **each** l **in** 1:length(decoder.layers) **do**
        layer ← decoder.layers\[l\]

        /\* first sublayer \*/
        z\_d\_copy ← copy(z\_d)
        **for each** t **in** 1:length(z\_d) **do**
            z\_d\[t\] ← layer.layer\_norm(z\_d\[t\])
        z\_d ← layer.masked\_multihead\_attention(z\_d, z\_d, z\_d)
        **for each** t **in** 1:length(z\_d) **do**
            z\_d\[t\] ← z\_d\[t\] + z\_d\_copy\[t\]

        /\* second sublayer \*/
        z\_d\_copy ← copy(z\_d)
        **for each** t **in** 1:length(z\_d) **do**
            z\_d\[t\] ← layer.layer\_norm(z\_d\[t\])
        z\_d ← layer.multihead\_attention(z\_d, z\_e, z\_e)
       **for each** t **in** 1:length(z\_d) **do**
           z\_d\[t\] ← z\_d\[t\] + z\_d\_copy\[t\]

        /\* third sublayer \*/
        z\_d\_copy ← copy(z\_d)
        **for each** t **in** 1:length(z\_d) **do**
            z\_d\[t\] ← layer.layer\_norm(z\_d\[t\])
        z\_d ← layer.feedforward(z\_d)
        **for each** t **in** 1:length(z\_d) **do**
            z\_d\[t\] ← z\_d\[t\] + z\_d\_copy\[t\]

z\_d ← decoder.final\_layer\_norm(z\_d)

output\_distributions ← \[\]
**for each** t **in** 1:length(z\_d) **do**
    output\_distributions.append(decoder.unembed(z\_d\[t\]))

**return** output\_distributions

### Terminology

The transformer architecture, being modular, allows variations. Several common variations are described here.

An "encoder-only" transformer applies the encoder to map an input text into a sequence of vectors that represent the input text. This is usually used for text embedding and [representation learning](https://en.wikipedia.org/wiki/Feature_learning) for downstream applications. [BERT](https://en.wikipedia.org/wiki/BERT_(language_model)) is encoder-only. They are less often used currently, as they were found to be not significantly better than training an encoder–decoder transformer, then taking just the encoder. They are also referred to as "all-to-all" or "BERT-like".

A "decoder-only" transformer is not literally decoder-only, since without an encoder, the cross-attention mechanism has nothing to attend to. Thus, the decoder layers in a decoder-only transformer is composed of just two sublayers: the causally masked self-attention, and the feedforward network. This is usually used for [text generation](https://en.wikipedia.org/wiki/Natural_language_generation) and [instruction following](https://en.wikipedia.org/wiki/Large_language_model#Instruction_tuning). The models in the [GPT series](https://en.wikipedia.org/wiki/Generative_pre-trained_transformer) and [Chinchilla series](https://en.wikipedia.org/wiki/Chinchilla_(language_model)) are decoder-only. They are also referred to as "autoregressive" or "causal".

An "encoder–decoder" transformer is generally the same as the original transformer, with 2 sublayers per encoder layer and 3 sublayers per decoder layer, etc. They might have minor architectural improvements, such as [alternative activation functions](https://en.wikipedia.org/wiki/Transformer_(deep_learning)#Alternative_activation_functions), [changing the location of normalization](https://en.wikipedia.org/wiki/Transformer_(deep_learning)#pre-LN), etc. This is also usually used for text generation and instruction following. The models in the [T5 series](https://en.wikipedia.org/wiki/T5_(language_model)) are encoder–decoder.

A "prefixLM" (prefix language model) is a decoder-only architecture, but with prefix masking, which is different from causal masking. Specifically, it has mask of the form   where the first columns correspond to the "prefix", and the subsequent columns correspond to the autoregressively generated text based on the prefix. They resemble encoder–decoder models, but has less "sparsity". Such models are rarely used, though they are cited as theoretical possibilities and benchmarked comparisons.

There are also mixed seq2seq models. For example, in 2020, Google Translate replaced the previous RNN-encoder–RNN-decoder model with a transformer-encoder–RNN-decoder model, as transformer-based decoders did not appear to significantly increase quality unlike the encoder, while the RNN decoder was much faster.

## Subsequent work

### Alternative activation functions

The original transformer uses [ReLU](https://en.wikipedia.org/wiki/ReLU) [activation function](https://en.wikipedia.org/wiki/Activation_function). Other activation functions were developed. The [Llama series](https://en.wikipedia.org/wiki/Llama_(language_model)) and [PaLM](https://en.wikipedia.org/wiki/PaLM) used SwiGLU; both GPT-1 and BERT used GELU.

Alternative activation functions are often used in combination with [Gated Linear Units](https://en.wikipedia.org/wiki/Gated_Linear_Unit) in the feedforward module.

### Alternative normalizations

The normalization used in the transformer can be different from LayerNorm. One example is [RMSNorm](https://en.wikipedia.org/wiki/RMSNorm) which is used in the [Llama series](https://en.wikipedia.org/wiki/Llama_(language_model)). Other examples include ScaleNorm and FixNorm.

### Alternative positional encodings

Transformers may use other positional encoding methods than sinusoidal.

The original transformer paper reported using a learned positional encoding, but finding it not superior to the sinusoidal one. Later, found that causal masking itself provides enough signal to a transformer decoder that it can learn to implicitly perform absolute positional encoding without the positional encoding module.

#### RoPE

RoPE (rotary positional embedding), is best explained by considering a list of 2-dimensional vectors  . Now pick some angle  . Then RoPE encoding is  Equivalently, if we write the 2-dimensional vectors as complex numbers  , then RoPE encoding is just multiplication by an angle:  For a list of  \-dimensional vectors, a RoPE encoder is defined by a sequence of angles  . Then the RoPE encoding is applied to each pair of coordinates.

The benefit of RoPE is that the dot-product between two vectors depends on their relative location only:  for any integer  .

#### ALiBi

ALiBi (Attention with Linear Biases) is not a _replacement_ for the positional encoder on the original transformer. Instead, it is an _additional_ positional encoder that is directly plugged into the attention mechanism. Specifically, the ALiBi attention mechanism is  Here,   is a real number ("scalar"), and   is the _linear bias_ matrix defined by  in other words,  . The idea being that the linear bias matrix is a softened mask. Just as   represent full attention paid, and   represents no attention paid, the linear bias matrix increases attention paid in one direction and decreases attention paid in the other direction.

ALiBi allows pretraining on short context windows, then fine-tuning on longer context windows. Since it is directly plugged into the attention mechanism, it can be combined with any positional encoder that is plugged into the "bottom" of the entire network (which is where the sinusoidal encoder on the original transformer, as well as RoPE and many others, are located).

#### Relative Position Encodings

Relative Position Encodings is similar to ALiBi, but more generic:  where   is a [Toeplitz matrix](https://en.wikipedia.org/wiki/Toeplitz_matrix), that is,   whenever  . This is contrasted with the original sinusoidal positional encoding, which is an "absolute positional encoding".

### Efficient implementation

The transformer model has been implemented in standard deep learning [frameworks](https://en.wikipedia.org/wiki/Framework_(computer_science)) such as [TensorFlow](https://en.wikipedia.org/wiki/TensorFlow) and [PyTorch](https://en.wikipedia.org/wiki/PyTorch). _Transformers_ is a library produced by [Hugging Face](https://en.wikipedia.org/wiki/Hugging_Face) that supplies transformer-based architectures and pretrained models.

#### KV caching

When an autoregressive transformer is used for inference, such as generating text, the query vector is different at each step, but the already-computed key and value vectors are always the same. The **KV caching** method saves the computed key and value vectors at each attention block, so that they are not recomputed at each new token. [PagedAttention](https://en.wikipedia.org/wiki/PagedAttention) applies [memory paging](https://en.wikipedia.org/wiki/Memory_paging) to KV caching.

If a transformer is used with a baked-in prompt, such as \["You are a customer support agent..."\], then the key and value vectors can be computed for the prompt, and saved on disk. The saving in compute is significant when the model is used for many short real-time interactions, such as in online chatbots.

In general, when a user uses an autoregressive transformer to generate a continuation to a sequence of tokens, the model would first perform a forward-pass on this sequence, whereby the KV caches over this sequence are computed. This is called **prefilling**. [Hyperscalers](https://en.wikipedia.org/wiki/Hyperscale_computing) serving large Transformer models may use **disaggregated inference**, wherein prefilling and decoding are performed on separately specialized hardware.

#### FlashAttention

FlashAttention is an algorithm that implements the transformer attention mechanism efficiently on a [GPU](https://en.wikipedia.org/wiki/Graphics_processing_unit). It is a communication-avoiding algorithm that performs [matrix multiplications in blocks](https://en.wikipedia.org/wiki/Block_matrix#Block_matrix_operations), such that each block fits within the [cache](https://en.wikipedia.org/wiki/Cache_(computing)) of a GPU, and by careful management of the blocks it minimizes data copying between GPU caches (as data movement is slow).

The [FlashAttention](https://en.wikipedia.org/wiki/FlashAttention) method is a [communication-avoiding algorithm](https://en.wikipedia.org/wiki/Communication-avoiding_algorithm) that fuses these operations into a single loop, increasing the [arithmetic intensity](https://en.wikipedia.org/wiki/Arithmetic_intensity). It is an [online algorithm](https://en.wikipedia.org/wiki/Online_algorithm) that computes the following quantities:  and returns  . In practice, FlashAttention operates over multiple queries and keys per loop iteration, in a similar way as [blocked matrix multiplication](https://en.wikipedia.org/wiki/Communication-avoiding_algorithm#Blocked_(tiled)_matrix_multiplication). If [backpropagation](https://en.wikipedia.org/wiki/Backpropagation) is needed, then the output vectors and the intermediate arrays   are cached, and during the backward pass, attention matrices are [rematerialized](https://en.wikipedia.org/wiki/Rematerialization) from these, making it a form of gradient checkpointing.

An improved version, FlashAttention-2, was developed to cater to the rising demand for language models capable of handling longer context lengths. It offers enhancements in work partitioning and parallelism, enabling it to achieve up to 230 TFLOPs/s on [A100](https://en.wikipedia.org/wiki/Nvidia_A100) GPUs ([FP16](https://en.wikipedia.org/wiki/FP16)/[BF16](https://en.wikipedia.org/wiki/BF16)), a 2x speed increase over the original FlashAttention.

Key advancements in FlashAttention-2 include the reduction of non-matmul FLOPs, improved parallelism over the sequence length dimension, better work partitioning between GPU warps, and added support for head dimensions up to 256 and multi-query attention (MQA) and grouped-query attention (GQA).

Benchmarks revealed FlashAttention-2 to be up to 2x faster than FlashAttention and up to 9x faster than a standard attention implementation in PyTorch. Future developments include optimization for new hardware like [H100](https://en.wikipedia.org/wiki/Nvidia_H100) GPUs and new data types like [FP8](https://en.wikipedia.org/wiki/Floating-point_arithmetic).

FlashAttention-4 focuses on [pipelining](https://en.wikipedia.org/wiki/Pipeline_(Unix)) to increase instruction [throughput](https://en.wikipedia.org/wiki/Network_throughput), and was developed to perform particularly well on [Blackwell GPUs](https://en.wikipedia.org/wiki/Blackwell_(microarchitecture)).

#### Multi-Query Attention

Multi-Query Attention changes the Multihead Attention mechanism. Whereas normally,

 with Multi-Query Attention, there is just one  , thus:

This has a neutral effect on model quality and training speed, but increases inference speed.

More generally, grouped-query attention (GQA) partitions attention heads into groups, each of which shares the key-value pair. MQA is GQA with one group, while standard Multihead Attention is GQA with the maximal number of groups.

Multihead Latent Attention (MLA) is a [low-rank approximation](https://en.wikipedia.org/wiki/Low-rank_approximation) to standard MHA. Specifically, each hidden vector, before entering the attention mechanism, is first projected to two low-dimensional spaces ("latent space"), one for query and one for key-value (KV vector). This design minimizes the KV cache, as only the low-dimensional KV vector needs to be cached.

#### Speculative decoding

Speculative decoding is a method to accelerate token decoding. Similarly to [speculative execution](https://en.wikipedia.org/wiki/Speculative_execution) in CPUs, future tokens are computed quickly, then verified. If the quickly computed tokens are incorrect, they are discarded and computed slowly.

The key factor in speculative decoding is that a transformer decoder can verify faster than it can decode, in the following sense.

Suppose we have two transformer models like GPT-3 and GPT-3-small, both with a context window size of 512. To generate an entire context window autoregressively with greedy decoding with GPT-3, it must be run for 512 times, each time generating a token  , taking time  . However, if we had some educated guess for the values of these tokens, we could verify all of them in parallel, in one run of the model, by checking that each   is indeed the token with the largest log-likelihood in the  \-th output.

In speculative decoding, a smaller model or some other simple heuristic is used to generate a few speculative tokens that are subsequently verified by the larger model. For example, suppose we use GPT-3-small to generate four speculative tokens:  . This only takes  . These tokens are then run through the larger GPT-3 in one go. Suppose that   and   are verified by GPT-3 as what it would have picked, then those are kept, but   is not, so   are discarded, and GPT-3 is run on those. This would take  , which might be shorter than  .

For non-greedy decoding, similar ideas apply, except the speculative tokens are accepted or rejected stochastically, in a way that guarantees the final output distribution is the same as if speculative decoding was not used.

In Multi-Token Prediction, a single forward pass creates a final embedding vector, which then is un-embedded into a token probability. However, that vector can then be further processed by another transformer block to predict the _next_ token, and so on for arbitrarily many steps into the future. This trades off accuracy for speed, since each new token costs just one more transformer block, rather than the entire stack.

### Sub-quadratic transformers

Training transformer-based architectures can be expensive, especially for long inputs. Many methods have been developed to attempt to address the issue. In the image domain, Swin transformer is an efficient architecture that performs attention inside shifting windows. In the audio domain, SepTr decouples the attention in time and frequency domains. _Long Range Arena_ (2020) is a standard benchmark for comparing the behavior of transformer architectures over long inputs.

#### Alternative attention graphs

The standard attention graph is either all-to-all or causal, both of which scales as   where   is the number of tokens in a sequence.

Reformer (2020) reduces the computational load from   to   by using [locality-sensitive hashing](https://en.wikipedia.org/wiki/Locality-sensitive_hashing) and reversible layers.

Sparse attention uses attention graphs that grows slower than  . For example, BigBird (2020) uses random [small-world networks](https://en.wikipedia.org/wiki/Small-world_network) which grows as  .

Ordinary transformers require a memory size that is quadratic in the size of the context window. Attention-free transformers reduce this to a linear dependence while still retaining the advantages of a transformer by linking the key to the value.

#### Random Feature Attention

Random Feature Attention (2021) uses [Fourier random features](https://en.wikipedia.org/wiki/Radial_basis_function_kernel#Fourier_random_features):  where   are independent samples from the normal distribution  . This choice of parameters satisfy  , or  Consequently, the one-headed attention, with one query, can be written as  where  . Similarly for multiple queries, and for multihead attention.

This approximation can be computed in linear time, as we can compute the matrix   first, then multiply it with the query. In essence, we have managed to obtain a more precise version of  Performer (2022) uses the same Random Feature Attention, but   are first independently sampled from the normal distribution  , then they are [Gram–Schmidt processed](https://en.wikipedia.org/wiki/Gram–Schmidt_process).

### Multimodality

Transformers can also be used/adapted for modalities (input or output) beyond just text, usually by finding a way to "tokenize" the modality.

Multimodal models can either be trained from scratch, or by finetuning. A 2022 study found that transformers pretrained only on natural language can be finetuned on only 0.03% of parameters and become competitive with [LSTMs](https://en.wikipedia.org/wiki/LSTMs) on a variety of logical and visual tasks, demonstrating [transfer learning](https://en.wikipedia.org/wiki/Transfer_learning). The LLaVA was a vision-language model composed of a language model (Vicuna-13B) and a vision model ([ViT](https://en.wikipedia.org/wiki/Vision_transformer)\-L/14), connected by a linear layer. Only the linear layer is finetuned.

[Vision transformers](https://en.wikipedia.org/wiki/Vision_transformer) adapt the transformer to computer vision by breaking down input images as a series of patches, turning them into vectors, and treating them like embedding vector of tokens in a standard transformer.

Conformer and later [Whisper](https://en.wikipedia.org/wiki/Whisper_(speech_recognition_system)) follow the same pattern for [speech recognition](https://en.wikipedia.org/wiki/Speech_recognition), first turning the speech signal into a [spectrogram](https://en.wikipedia.org/wiki/Spectrogram), which is then treated like an image, i.e. broken down into a series of patches, turned into vectors and treated like embedding vector of tokens in a standard transformer.

[Perceivers](https://en.wikipedia.org/wiki/Perceiver) are a variant of transformers designed for multimodality.

For image generation, notable architectures are [DALL-E 1](https://en.wikipedia.org/wiki/DALL-E) (2021), Parti (2022), Phenaki (2023), and Muse (2023). Unlike later models, DALL-E is not a [diffusion model](https://en.wikipedia.org/wiki/Diffusion_model). Instead, it uses a decoder-only transformer that autoregressively generates a text, followed by the token representation of an image, which is then converted by a [variational autoencoder](https://en.wikipedia.org/wiki/Variational_autoencoder) to an image. Parti is an encoder–decoder transformer, where the encoder processes a text prompt, and the decoder generates a token representation of an image. Muse is an encoder-only transformer that is trained to predict masked image tokens from unmasked image tokens. During generation, all input tokens are masked, and the highest-confidence predictions are included for the next iteration, until all tokens are predicted. Phenaki is a text-to-video model. It is a bidirectional masked transformer conditioned on pre-computed text tokens. The generated tokens are then decoded to a video.

## Applications

The transformer has had great success in [natural language processing](https://en.wikipedia.org/wiki/Natural_language_processing) (NLP). Many [large language models](https://en.wikipedia.org/wiki/Large_language_model) such as [GPT-2](https://en.wikipedia.org/wiki/GPT-2), [GPT-3](https://en.wikipedia.org/wiki/GPT-3), [GPT-4](https://en.wikipedia.org/wiki/GPT-4), [Gemini](https://en.wikipedia.org/wiki/Gemini_(chatbot)), AlbertAGPT, [Claude](https://en.wikipedia.org/wiki/Anthropic#Claude), [BERT](https://en.wikipedia.org/wiki/BERT_(language_model)), [Grok](https://en.wikipedia.org/wiki/Grok_(chatbot)), [XLNet](https://en.wikipedia.org/wiki/XLNet), [RoBERTa](https://en.wikipedia.org/wiki/BERT_(language_model)#RoBERTa) and [ChatGPT](https://en.wikipedia.org/wiki/ChatGPT) demonstrate the ability of transformers to perform a wide variety of NLP-related subtasks and their related real-world applications, including:

-   [machine translation](https://en.wikipedia.org/wiki/Machine_translation)
-   [time series](https://en.wikipedia.org/wiki/Time_series) prediction
-   [document summarization](https://en.wikipedia.org/wiki/Automatic_summarization)
-   [document generation](https://en.wikipedia.org/wiki/Natural_language_generation)
-   [named entity recognition](https://en.wikipedia.org/wiki/Named-entity_recognition) (NER)
-   [writing computer code](https://en.wikipedia.org/wiki/Computer_programming) based on requirements expressed in natural language.
-   [speech-to-text](https://en.wikipedia.org/wiki/Speech-to-text)

Beyond traditional NLP, the transformer architecture has had success in other applications, such as:

-   [biological sequence analysis](https://en.wikipedia.org/wiki/Sequence_analysis)
-   [video understanding](https://en.wikipedia.org/wiki/Computer_vision)
-   [protein folding](https://en.wikipedia.org/wiki/Protein_structure_prediction) (such as [AlphaFold](https://en.wikipedia.org/wiki/AlphaFold))
-   [evaluating](https://en.wikipedia.org/wiki/Evaluation_function) chess board positions. Using static evaluation alone (that is, with no [Minimax](https://en.wikipedia.org/wiki/Minimax) search) transformer achieved an [Elo](https://en.wikipedia.org/wiki/Elo_rating_system) of 2895, putting it at [grandmaster](https://en.wikipedia.org/wiki/Grandmaster_(chess)) level.
