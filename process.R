chooseCRANmirror(ind = 81)
# Needed <- c('tm', 'SnowballCC', 'RColorBrewer', 'ggplot2', 'wordcloud',
# 'biclust', 'cluster', 'igraph', 'fpc') install.packages(Needed, dependencies =
# TRUE) install.packages('Rcampdf', repos = 'http://datacube.wu.ac.at/', type =
# 'source') install.packages('pdftools')
library(pdftools)
library(tm)
files <- list.files(path = ".", pattern = "pdf$", recursive = TRUE)
opinions <- lapply(files, pdf_text)
docs <- Corpus(VectorSource(opinions))
docs2 <- tm_map(docs, removeWords, stopwords("dutch"))
opinions.tdm <- TermDocumentMatrix(docs2, control = list(
  removePunctuation = TRUE,
  stopwords = TRUE,
  tolower = TRUE,
  stemming = TRUE,
  removeNumbers = TRUE,
  bounds = list(global = c(3, Inf))))
 raadsinformatie <- as.matrix(opinions.tdm)
write.csv(raadsinformatie, "raadsinformatie.csv")
